"""AI-1 pipeline on real automotive production images: AutoVI (Renault Group / UTC).

    python ml/autovi_eval.py C:/Users/mikae/dev/autovi_data pipe_staple pipe_clip engine_wiring
    python ml/autovi_eval.py <root> <cats...> --layers 2,3 --size 384 --tag std   # sensitivity check

Same method as ml/train_eval.py: frozen ImageNet ResNet-18 (layer1 + layer2, 3x3 local
averaging, 192 dims), greedy-coreset memory bank of normal patches, nearest-neighbour
distance heatmap, image score = heatmap maximum, split-conformal threshold.

Two protocols per category:
  A. Benchmark: bank from all training good images; image AUROC on the test set
     (comparable to published AutoVI results).
  B. Deployment: bank from half of the training good images, threshold from the other
     half (split-conformal) for target false-alarm rates of 0.042% and 1%; false-alarm rate
     on test good images (95% Clopper-Pearson) and share of defective test images caught.

The dataset is CC BY-NC-SA 4.0 (Carvalho et al. 2024, doi:10.5281/zenodo.10459003).
Images stay outside the repo; only numbers are written (ml/results/autovi_metrics.json).
"""
from __future__ import annotations

import glob
import json
import math
import os
import sys
import time

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from sklearn.metrics import roc_auc_score

from patchcore import PatchCore, greedy_coreset
from train_eval import clopper_pearson

HERE = os.path.dirname(os.path.abspath(__file__))
SIZE = 256
LAYERS = (1, 2)
TAG = "ai1"
BANK = 6_000
CANDIDATES = 200_000  # random pre-sample before the greedy coreset (keeps selection to minutes)
TARGETS = {"0.042%": 2 / 4800, "1%": 0.01}


def load(paths: list[str]) -> torch.Tensor:
    arr = np.stack([np.asarray(Image.open(p).convert("RGB").resize((SIZE, SIZE), Image.BILINEAR)) for p in paths])
    return torch.from_numpy(arr).permute(0, 3, 1, 2).float().div_(255.0)


@torch.no_grad()
def bank_from(model: PatchCore, paths: list[str], dev) -> torch.Tensor:
    feats = []
    for i in range(0, len(paths), 16):
        f = model.features(load(paths[i:i + 16]).to(dev))
        feats.append(f.flatten(2).transpose(1, 2).reshape(-1, f.shape[1]).half())
    allf = torch.cat(feats)
    if len(allf) > CANDIDATES:
        g = torch.Generator(device="cpu").manual_seed(0)
        allf = allf[torch.randperm(len(allf), generator=g)[:CANDIDATES].to(allf.device)]
    allf = allf.float()
    return greedy_coreset(allf, min(BANK, len(allf)))


@torch.no_grad()
def score(model: PatchCore, bank: torch.Tensor, paths: list[str], dev) -> tuple[np.ndarray, float]:
    out = []
    bsq = (bank * bank).sum(1)
    r = model.kx.shape[-1] // 2
    t0 = time.perf_counter()
    for i in range(0, len(paths), 4):
        x = load(paths[i:i + 4]).to(dev)
        f = model.features(x)
        b, d, h, w = f.shape
        q = f.flatten(2).transpose(1, 2).reshape(-1, d)
        best = torch.full((q.shape[0],), float("inf"), device=dev)
        qsq = (q * q).sum(1)
        for j in range(0, bank.shape[0], 4096):
            chunk = bank[j:j + 4096]
            d2 = qsq[:, None] - 2 * q @ chunk.T + bsq[j:j + 4096][None, :]
            best = torch.minimum(best, d2.min(1).values)
        dist = torch.sqrt(best.clamp_min(0)).view(b, 1, h, w)
        amap = F.interpolate(dist, size=(SIZE, SIZE), mode="bilinear", align_corners=False)
        amap = F.conv2d(F.pad(amap, (r, r, 0, 0), mode="replicate"), model.kx)
        amap = F.conv2d(F.pad(amap, (0, 0, r, r), mode="replicate"), model.ky)
        out.append(amap.flatten(1).max(1).values.cpu().numpy())
    if dev.type == "cuda":
        torch.cuda.synchronize()
    return np.concatenate(out), (time.perf_counter() - t0) / len(paths) * 1000


def conformal(cal: np.ndarray, alpha: float) -> tuple[float, int]:
    """k-th largest calibration score, k = floor((n+1) alpha); if k < 1 the rule cannot reach
    alpha with n images and we use the largest score (bounds the rate by 1/(n+1))."""
    n = len(cal)
    k = int(math.floor((n + 1) * alpha))
    return float(np.sort(cal)[::-1][max(k, 1) - 1]), k


def main():
    global SIZE, LAYERS, TAG
    args = sys.argv[1:]
    for flag in ("--layers", "--size", "--tag"):
        if flag in args:
            i = args.index(flag)
            val = args[i + 1]
            del args[i:i + 2]
            if flag == "--layers":
                LAYERS = tuple(int(x) for x in val.split(","))
            elif flag == "--size":
                SIZE = int(val)
            else:
                TAG = val
    root, cats = args[0], args[1:]
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = PatchCore(LAYERS).to(dev).eval()
    rng = np.random.default_rng(2024)
    results = {}
    for cat in cats:
        t_start = time.time()
        train = sorted(glob.glob(os.path.join(root, cat, "train", "good", "*.png")))
        test_good = sorted(glob.glob(os.path.join(root, cat, "test", "good", "*.png")))
        defect_dirs = sorted(d for d in glob.glob(os.path.join(root, cat, "test", "*")) if os.path.basename(d) != "good")
        test_bad = {os.path.basename(d): sorted(glob.glob(os.path.join(d, "*.png"))) for d in defect_dirs}
        bad_all = [p for v in test_bad.values() for p in v]

        # A. benchmark protocol
        bank_a = bank_from(model, train, dev)
        s_good, ms = score(model, bank_a, test_good, dev)
        s_bad, _ = score(model, bank_a, bad_all, dev)
        auroc_a = roc_auc_score(np.r_[np.zeros(len(s_good)), np.ones(len(s_bad))], np.r_[s_good, s_bad])
        # TPR at a fixed TNR, threshold read off the test good images (as in the AutoVI paper)
        tpr_at = {f"tnr{int(t * 100)}": float((s_bad > np.quantile(s_good, t)).mean()) for t in (0.95, 0.99)}

        # B. deployment protocol
        perm = rng.permutation(len(train))
        half = len(train) // 2
        bank_paths = [train[i] for i in perm[:half]]
        cal_paths = [train[i] for i in perm[half:]]
        bank_b = bank_from(model, bank_paths, dev)
        s_cal, _ = score(model, bank_b, cal_paths, dev)
        g_b, _ = score(model, bank_b, test_good, dev)
        bad_b = {k: score(model, bank_b, v, dev)[0] for k, v in test_bad.items()}
        all_bad_b = np.concatenate(list(bad_b.values()))
        auroc_b = roc_auc_score(np.r_[np.zeros(len(g_b)), np.ones(len(all_bad_b))], np.r_[g_b, all_bad_b])
        thresholds = {}
        for name, alpha in TARGETS.items():
            thr, k = conformal(s_cal, alpha)
            fp = int((g_b > thr).sum())
            lo, hi = clopper_pearson(fp, len(g_b))
            thresholds[name] = {
                "alpha": alpha, "k": k, "certifiable": k >= 1, "threshold": thr,
                "bound_if_not_certifiable": 1 / (len(s_cal) + 1),
                "false_alarms": fp, "good_test": len(g_b), "fpr": fp / len(g_b), "fpr_95ci": [lo, hi],
                "caught": int((all_bad_b > thr).sum()), "defective": len(all_bad_b),
                "caught_by_type": {k2: [int((v > thr).sum()), len(v)] for k2, v in bad_b.items()},
            }
        # CPU latency, one thread, 5 images (bank A)
        torch.set_num_threads(1)
        cpu_model = model.cpu()
        _, cpu_ms = score(cpu_model, bank_a.cpu(), test_good[:5], torch.device("cpu"))
        model.to(dev)
        torch.set_num_threads(os.cpu_count() or 4)
        results[f"{TAG}:{cat}"] = {
            "config": {"layers": list(LAYERS), "size": SIZE, "bank": BANK, "coreset_candidates": CANDIDATES},
            "train_good": len(train), "test_good": len(test_good), "test_defective": {k: len(v) for k, v in test_bad.items()},
            "benchmark": {"image_auroc": auroc_a, "bank": int(bank_a.shape[0]), "tpr_at_tnr": tpr_at,
                          "scores": {"good": s_good.tolist(), "bad": s_bad.tolist()}},
            "deployment": {"bank_images": len(bank_paths), "calibration_images": len(cal_paths), "image_auroc": auroc_b, "thresholds": thresholds},
            "latency_ms": {"gpu_gtx1650": ms, "cpu_1thread": cpu_ms},
            "scores": {"cal": s_cal.tolist(), "good": g_b.tolist(), "bad": {k: v.tolist() for k, v in bad_b.items()}},
            "seconds": round(time.time() - t_start),
        }
        t = thresholds["1%"]
        print(f"{TAG}:{cat}: TPR@TNR95 {tpr_at['tnr95']:.2f} TPR@TNR99 {tpr_at['tnr99']:.2f} | AUROC A {auroc_a:.3f} B {auroc_b:.3f} | thr {t['threshold']:.2f} FPR {t['false_alarms']}/{t['good_test']} caught {t['caught']}/{t['defective']} | {ms:.0f} ms GPU, {cpu_ms:.0f} ms CPU", flush=True)

    out = os.path.join(HERE, "results", "autovi_metrics.json")
    old = json.load(open(out)) if os.path.exists(out) else {}
    old.update(results)
    old["_meta"] = {"backbone": "resnet18 ImageNet", "tags": {"ai1": "shipped AI-1 config (layer1+2, 256 px)", "std": "PatchCore-like (layer2+3)"}, "dataset": "AutoVI v1.0.0, doi:10.5281/zenodo.10459003, CC BY-NC-SA 4.0"}
    json.dump(old, open(out, "w"), indent=1)


if __name__ == "__main__":
    main()
