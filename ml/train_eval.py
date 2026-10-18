"""Train, calibrate, evaluate and export the PatchCore-style sealer-bead model.

    python ml/train_eval.py                 # full run and export (~15-25 min on a GTX 1650)
    python ml/train_eval.py --quick         # small smoke run, no export

Pipeline
1. Memory bank: ImageNet ResNet-18 features (layer1 + layer2, 3x3 local averaging, 192
   dims) of good beads, greedy coreset of 1024 patches per seam. ml/experiment.py holds
   the comparison that chose these settings (results/experiments.jsonl).
2. Score: distance of each patch to its nearest bank patch, upsampled and blurred into a
   heatmap; the score of a crop is the heatmap maximum.
3. Threshold per seam from good calibration crops (split-conformal rule) so the whole
   station stays within the false-alarm budget of 2 per shift (300 bodies x 16 seams).
4. Evaluation on separate good crops, random-severity defects, 59 limit samples per
   defect type and strong reflections that the model never saw.
5. ONNX export (opset 17) for onnxruntime-web, checked against PyTorch.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import time
from multiprocessing import Pool

import numpy as np

import beadsynth as bs

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RESULTS = os.path.join(HERE, "results")
PUBLIC = os.path.join(ROOT, "public", "models")
META = os.path.join(ROOT, "lib", "vision", "bead-model.json")

MODEL_VERSION = "bead-patchcore-r18-syn-v1"
BODIES_PER_SHIFT = 300  # docs/SEED_DATA.md section 2 (ES Appendix D assumption)
FA_BUDGET = 2  # false alarms per station per shift (ES Gate 1)
N_SEAMS = 16

SPLIT_CODE = {"train": 1, "cal": 2, "test": 3, "defect": 4, "limit": 5, "glare": 6, "example": 7}


# ---------------------------------------------------------------- data

def make_params(split: str, n_per: int, defect: str = "none", level: str = "random",
                strong_glare: bool = False, seams=range(N_SEAMS)) -> list[dict]:
    out = []
    code = SPLIT_CODE[split]
    dcode = (["none"] + bs.DEFECT_TYPES).index(defect)
    for s in seams:
        rng = np.random.default_rng([code, dcode, s])
        out += [bs.sample_params(rng, s, defect, level, strong_glare) for _ in range(n_per)]
    return out


def batches(pool, params: list[dict], bsz: int = 128):
    chunks = [params[i:i + 16] for i in range(0, len(params), 16)]
    buf, meta = [], []
    for arr, ps in zip(pool.imap(bs.render_batch, chunks), chunks):
        buf.append(arr)
        meta += ps
        if len(meta) >= bsz:
            yield np.concatenate(buf), meta
            buf, meta = [], []
    if meta:
        yield np.concatenate(buf), meta


def score_all(model, pool, params, dev) -> np.ndarray:
    import torch
    from patchcore import to_tensor

    scores = []
    t0 = time.time()
    with torch.no_grad():
        for i, (arr, ps) in enumerate(batches(pool, params)):
            if i % 50 == 0:
                print(f"  batch {i} of {len(params) // 128 + 1} ({time.time() - t0:.0f}s)", flush=True)
            seam = torch.tensor([p["seam"] for p in ps], device=dev)
            x = to_tensor(arr, dev)
            for j in range(0, len(ps), 32):  # small slices keep the distance matrix within 4 GB VRAM
                _, s = model(x[j:j + 32], seam[j:j + 32])
                scores.append(s.cpu().numpy())
    return np.concatenate(scores) if scores else np.zeros(0)


def build_bank(model, pool, n_train: int, dev):
    import torch
    from patchcore import greedy_coreset, to_tensor

    with torch.no_grad():
        for s in range(N_SEAMS):
            ps = make_params("train", n_train, seams=[s])
            feats = []
            for arr, _ in batches(pool, ps):
                f = model.features(to_tensor(arr, dev))
                feats.append(f.flatten(2).transpose(1, 2).reshape(-1, f.shape[1]))
            model.bank[s] = greedy_coreset(torch.cat(feats), model.bank.shape[1])
            del feats
            torch.cuda.empty_cache()


# ---------------------------------------------------------------- stats

def conformal_threshold(cal: np.ndarray, alpha: float) -> float:
    """k-th largest calibration score with k = floor((n+1) * alpha); P(good > thr) <= alpha."""
    n = len(cal)
    k = int(math.floor((n + 1) * alpha))
    srt = np.sort(cal)[::-1]
    if k < 1:
        return float(srt[0] * 1.02)
    return float(srt[k - 1])


def clopper_pearson(k: int, n: int, conf: float = 0.95) -> tuple[float, float]:
    from scipy.stats import beta

    a = 1 - conf
    lo = 0.0 if k == 0 else beta.ppf(a / 2, k, n - k + 1)
    hi = 1.0 if k == n else beta.ppf(1 - a / 2, k + 1, n - k)
    return float(lo), float(hi)


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--layers", default="1,2")
    ap.add_argument("--bank", type=int, default=1024)
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--tag", default="")
    args = ap.parse_args()
    import torch
    from sklearn.metrics import roc_auc_score

    from patchcore import PatchCore

    layers = tuple(int(x) for x in args.layers.split(","))
    q = args.quick
    n_train, n_cal, n_test, n_def, n_glare = (20, 200, 200, 5, 5) if q else (60, 2500, 2500, 25, 25)

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.manual_seed(0)
    model = PatchCore(layers, bank_size=args.bank, scale=args.scale).to(dev).eval()
    os.makedirs(RESULTS, exist_ok=True)
    t0 = time.time()
    with Pool(max(1, (os.cpu_count() or 4) - 2)) as pool:
        build_bank(model, pool, n_train, dev)
        print(f"bank built {time.time() - t0:.0f}s", flush=True)

        alpha = FA_BUDGET / (BODIES_PER_SHIFT * N_SEAMS)  # per-seam false-alarm probability
        cal = make_params("cal", n_cal)
        cal_s = score_all(model, pool, cal, dev)
        seam_of = lambda ps: np.array([p["seam"] for p in ps])
        cal_seam = seam_of(cal)
        thr = np.array([conformal_threshold(cal_s[cal_seam == s], alpha) for s in range(N_SEAMS)])
        print(f"calibrated {time.time() - t0:.0f}s", flush=True)

        test = make_params("test", n_test)
        test_s = score_all(model, pool, test, dev)
        test_seam = seam_of(test)
        print(f"good test scored {time.time() - t0:.0f}s", flush=True)

        sets = {}
        for d in bs.DEFECT_TYPES:
            ps = make_params("defect", n_def, d)
            sets[("random", d)] = (ps, score_all(model, pool, ps, dev))
            rng = np.random.default_rng([SPLIT_CODE["limit"], bs.DEFECT_TYPES.index(d)])
            lim = [bs.sample_params(rng, i % N_SEAMS, d, "limit") for i in range(59)]
            sets[("limit", d)] = (lim, score_all(model, pool, lim, dev))
        glare = make_params("glare", n_glare, strong_glare=True)
        glare_s = score_all(model, pool, glare, dev)
        print(f"defects scored {time.time() - t0:.0f}s", flush=True)

    # --- metrics
    fa_per_seam = np.array([(test_s[test_seam == s] > thr[s]).sum() for s in range(N_SEAMS)])
    n_per = np.array([(test_seam == s).sum() for s in range(N_SEAMS)])
    k_fa, n_good = int(fa_per_seam.sum()), int(n_per.sum())
    rate_lo, rate_hi = clopper_pearson(k_fa, n_good)
    per_shift = BODIES_PER_SHIFT * N_SEAMS
    fa = {
        "budget_per_station_shift": FA_BUDGET,
        "crops_per_shift": per_shift,
        "alpha_per_seam": alpha,
        "good_test_crops": n_good,
        "false_alarms": k_fa,
        "expected_per_shift": k_fa / n_good * per_shift,
        "expected_per_shift_95ci": [rate_lo * per_shift, rate_hi * per_shift],
    }

    def detected(ps, sc):
        seam = seam_of(ps)
        return int((sc > thr[seam]).sum())

    per_type = {}
    for d in bs.DEFECT_TYPES:
        ps_r, sc_r = sets[("random", d)]
        ps_l, sc_l = sets[("limit", d)]
        y = np.r_[np.zeros(n_good), np.ones(len(sc_r))]
        per_type[bs.DEFECT_IDS[d]] = {
            "criticality": "leak_critical" if d in bs.LEAK_CRITICAL else "non_critical",
            "random_detected": detected(ps_r, sc_r), "random_n": len(sc_r),
            "limit_detected": detected(ps_l, sc_l), "limit_n": len(sc_l),
            "auroc": float(roc_auc_score(y, np.r_[test_s, sc_r])),
        }
    per_seam = []
    for s in range(N_SEAMS):
        good = test_s[test_seam == s]
        bad = np.concatenate([sc[seam_of(ps) == s] for (lvl, _), (ps, sc) in sets.items() if lvl == "random"])
        y = np.r_[np.zeros(len(good)), np.ones(len(bad))]
        per_seam.append({
            "seam": bs.SEAM_IDS[s], "threshold": float(thr[s]),
            "auroc": float(roc_auc_score(y, np.r_[good, bad])),
            "false_alarms": int(fa_per_seam[s]), "good_n": int(n_per[s]),
            "defects_detected": int((bad > thr[s]).sum()), "defects_n": int(len(bad)),
        })
    glare_flag = int((glare_s > thr[seam_of(glare)]).sum())

    metrics = {
        "model_version": MODEL_VERSION + args.tag,
        "config": {"backbone": "resnet18 (ImageNet)", "layers": list(layers), "bank_per_seam": args.bank,
                   "input_scale": args.scale, "feature_dim": int(model.proj.shape[0]), "projection": bool(model.use_proj),
                   "blur_sigma": 4.0},
        "data": {"train_per_seam": n_train, "cal_per_seam": n_cal, "test_good_per_seam": n_test,
                 "random_defects_per_type_per_seam": n_def, "limit_samples_per_type": 59,
                 "strong_reflection_crops": len(glare_s)},
        "false_alarms": fa,
        "per_type": per_type,
        "per_seam": per_seam,
        "strong_reflection": {"flagged": glare_flag, "n": len(glare_s)},
        "train_seconds": round(time.time() - t0),
    }
    print(json.dumps({k: metrics[k] for k in ("false_alarms", "per_type", "strong_reflection")}, indent=1))
    name = "metrics_quick.json" if q else f"metrics{args.tag}.json"
    with open(os.path.join(RESULTS, name), "w") as fh:
        json.dump(metrics, fh, indent=1)
    if q or args.tag:
        return

    export(model, thr, metrics, dev)
    examples(model, thr, dev)


def export(model, thr, metrics, dev):
    import onnx
    import torch
    import onnxruntime as ort
    from onnx import numpy_helper

    from patchcore import to_tensor

    model = model.cpu().eval()
    img = torch.rand(1, 3, bs.H, bs.W)
    seam = torch.tensor([3], dtype=torch.int64)
    path = os.path.join(RESULTS, "bead_patchcore.onnx")
    torch.onnx.export(model, (img, seam), path, opset_version=17,
                      input_names=["image", "seam"], output_names=["heatmap", "score"])

    # Store weights as float16 to halve the download; Cast nodes restore float32 at load.
    m = onnx.load(path)
    g = m.graph
    new_inits, casts = [], []
    for init in g.initializer:
        arr = numpy_helper.to_array(init)
        if arr.dtype == np.float32 and arr.size > 1024:
            half_name = init.name + "_fp16"
            new_inits.append(numpy_helper.from_array(arr.astype(np.float16), half_name))
            casts.append(onnx.helper.make_node("Cast", [half_name], [init.name], to=onnx.TensorProto.FLOAT))
        else:
            new_inits.append(init)
    del g.initializer[:]
    g.initializer.extend(new_inits)
    nodes = list(g.node)
    del g.node[:]
    g.node.extend(casts + nodes)
    onnx.checker.check_model(m)
    onnx.save(m, path)

    # Parity with PyTorch on fresh crops, and CPU latency (1 thread, like the browser).
    so = ort.SessionOptions()
    so.intra_op_num_threads = 1
    sess = ort.InferenceSession(path, so, providers=["CPUExecutionProvider"])
    rng = np.random.default_rng(123)
    diffs = []
    for i in range(8):
        p = bs.sample_params(rng, i * 2, bs.DEFECT_TYPES[i % 5] if i % 2 else "none")
        x = to_tensor(bs.render(p)[None], "cpu")
        s_t = model(x, torch.tensor([p["seam"]]))[1].item()
        s_o = sess.run(None, {"image": x.numpy(), "seam": np.array([p["seam"]], dtype=np.int64)})[1].item()
        diffs.append(abs(s_t - s_o) / max(s_t, 1e-6))
    feed = {"image": x.numpy(), "seam": np.array([0], dtype=np.int64)}
    for _ in range(3):
        sess.run(None, feed)
    t = time.perf_counter()
    for _ in range(30):
        sess.run(None, feed)
    ms = (time.perf_counter() - t) / 30 * 1000

    metrics["onnx"] = {"bytes": os.path.getsize(path), "max_rel_score_diff_vs_torch": float(max(diffs)),
                       "cpu_ms_1thread": round(ms, 1), "opset": 17}
    with open(os.path.join(RESULTS, "metrics.json"), "w") as fh:
        json.dump(metrics, fh, indent=1)
    fa = metrics["false_alarms"]
    meta = {
        "modelVersion": MODEL_VERSION,
        "evaluatedOn": time.strftime("%Y-%m-%d"),
        "input": {"width": bs.W, "height": bs.H, "layout": "NCHW RGB float32 0..1"},
        "config": metrics["config"],
        "seams": [{"id": bs.SEAM_IDS[s], "threshold": round(float(thr[s]), 4)} for s in range(N_SEAMS)],
        "falseAlarmBudget": FA_BUDGET,
        "bodiesPerShift": BODIES_PER_SHIFT,
        "evaluation": {
            "goodTestCrops": fa["good_test_crops"],
            "falseAlarms": fa["false_alarms"],
            "expectedFalseAlarmsPerShift": round(fa["expected_per_shift"], 2),
            "expectedFalseAlarmsPerShift95": [round(v, 2) for v in fa["expected_per_shift_95ci"]],
            "perType": {k: {"limitDetected": v["limit_detected"], "limitN": v["limit_n"],
                            "randomDetected": v["random_detected"], "randomN": v["random_n"],
                            "auroc": round(v["auroc"], 4), "criticality": v["criticality"]}
                        for k, v in metrics["per_type"].items()},
            "strongReflection": metrics["strong_reflection"],
            "cpuMs": metrics["onnx"]["cpu_ms_1thread"],
            "onnxBytes": metrics["onnx"]["bytes"],
        },
    }
    with open(META, "w") as fh:
        json.dump(meta, fh, indent=1)
        fh.write("\n")
    os.makedirs(PUBLIC, exist_ok=True)
    shutil.copy(path, os.path.join(PUBLIC, "bead_patchcore.onnx"))
    print("onnx", metrics["onnx"])


def examples(model, thr, dev):
    """One row per defect type at its limit: crop | heatmap overlay. Saved as a small PNG."""
    import torch
    from PIL import Image

    from patchcore import to_tensor

    model = model.to(dev)
    rng = np.random.default_rng([SPLIT_CODE["example"]])
    rows = []
    for i, d in enumerate(["none"] + bs.DEFECT_TYPES):
        p = bs.sample_params(rng, (i * 3) % N_SEAMS, d, "limit")
        img = bs.render(p)
        with torch.no_grad():
            amap, _ = model(to_tensor(img[None], dev), torch.tensor([p["seam"]], device=dev))
        a = amap[0, 0].cpu().numpy()
        t = thr[p["seam"]]
        heat = np.clip((a - 0.5 * t) / (0.8 * t), 0, 1)[..., None]
        yellow = np.array([242, 183, 5], dtype=np.float64)
        over = (img * (1 - 0.6 * heat) + yellow * 0.6 * heat).astype(np.uint8)
        rows.append(np.concatenate([img, np.full((bs.H, 4, 3), 255, np.uint8), over], 1))
        rows.append(np.full((4, rows[-1].shape[1], 3), 255, np.uint8))
    Image.fromarray(np.concatenate(rows[:-1])).save(os.path.join(RESULTS, "examples.png"), optimize=True)


if __name__ == "__main__":
    main()
