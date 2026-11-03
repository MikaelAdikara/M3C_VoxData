"""Internal test of the Learning Line camera method on real structural-adhesive images (Peres et al., 2021).

Method = the shipped model's design: ResNet-18 layer1+2 features (ImageNet weights, no training on defects),
memory bank of GOOD features only, per position ("per seam region": each location compares only with the same
location +/- r cells in good images), Gaussian-smoothed anomaly map. Baseline: one global bank (no position).
Protocol: GroupKFold over near-duplicate groups; in each fold the training groups are split 80/20 into bank and
calibration; thresholds are split-conformal quantiles of calibration normal-region scores; test groups unseen.
Usage: python -I peres_eval.py <data_dir> <out_dir>
"""
import sys, os, glob, json, math
import numpy as np
import torch, torch.nn.functional as F
from PIL import Image
from scipy.sparse.csgraph import connected_components
from sklearn.model_selection import GroupKFold
from sklearn.metrics import roc_auc_score
from torchvision.models import resnet18, ResNet18_Weights

DATA, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
dev = "cuda" if torch.cuda.is_available() else "cpu"
torch.manual_seed(0); np.random.seed(0)
RES, G, TILE, R, SIG = 512, 128, 32, 3, 4.0  # input px, feature grid, region px (at 512), position slack (cells), blur

files = sorted(glob.glob(os.path.join(DATA, "test", "*.png"))) + sorted(glob.glob(os.path.join(DATA, "holdout", "*.png")))
boxes = []
for f in files:
    b = []
    for ln in open(f[:-4] + ".txt").read().split("\n"):
        if ln.strip():
            c, x, y, w, h = ln.split(); b.append((int(c), float(x), float(y), float(w), float(h)))
    boxes.append(b)
gray = [np.asarray(Image.open(f).convert("L").resize((RES, RES), Image.BILINEAR), dtype=np.float32) for f in files]
rgb = [np.asarray(Image.open(f).convert("RGB").resize((RES, RES), Image.BILINEAR), dtype=np.float32) / 255 for f in files]

# near-duplicate groups (64x64 grayscale correlation > 0.99)
S = np.stack([np.asarray(Image.fromarray(g.astype(np.uint8)).resize((64, 64)), dtype=np.float32).ravel() for g in gray])
S = (S - S.mean(1, keepdims=True)) / S.std(1, keepdims=True)
_, groups = connected_components((S @ S.T / S.shape[1]) > 0.99)

net = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1).eval().to(dev)
mean = torch.tensor([0.485, 0.456, 0.406], device=dev).view(1, 3, 1, 1); std = torch.tensor([0.229, 0.224, 0.225], device=dev).view(1, 3, 1, 1)

@torch.no_grad()
def feats(img):
    x = (torch.from_numpy(img).permute(2, 0, 1)[None].to(dev) - mean) / std
    x = net.maxpool(net.relu(net.bn1(net.conv1(x))))
    f1 = net.layer1(x); f2 = net.layer2(f1)
    f1 = F.avg_pool2d(f1, 3, 1, 1); f2 = F.interpolate(F.avg_pool2d(f2, 3, 1, 1), size=f1.shape[-2:], mode="bilinear", align_corners=False)
    return torch.cat([f1, f2], 1)[0].half()  # (192,128,128)

FE = torch.stack([feats(im) for im in rgb])  # (N,192,G,G) on dev

def box_mask(i, scale, dil=0):
    m = np.zeros((scale, scale), bool)
    for c, x, y, w, h in boxes[i]:
        x0, x1 = int((x - w / 2) * scale) - dil, int(math.ceil((x + w / 2) * scale)) + dil
        y0, y1 = int((y - h / 2) * scale) - dil, int(math.ceil((y + h / 2) * scale)) + dil
        m[max(0, y0):max(0, y1), max(0, x0):max(0, x1)] = True
    return m

GOOD = torch.from_numpy(np.stack([~box_mask(i, G, dil=2) for i in range(len(files))])).to(dev)  # bank-eligible cells

k = torch.exp(-(torch.arange(-12, 13, dtype=torch.float32) ** 2) / (2 * SIG ** 2)); k = (k / k.sum()).to(dev)
def smooth_up(d):  # (G,G) distance -> (RES,RES) map
    a = F.interpolate(d[None, None].float(), size=(RES, RES), mode="bilinear", align_corners=False)
    a = F.conv2d(F.pad(a, (12, 12, 0, 0), mode="replicate"), k.view(1, 1, 1, -1))
    return F.conv2d(F.pad(a, (0, 0, 12, 12), mode="replicate"), k.view(1, 1, -1, 1))[0, 0]

@torch.no_grad()
def score_positional(q, bank_idx):
    best = torch.full((G, G), float("inf"), device=dev)
    Fb, Mb = FE[bank_idx], GOOD[bank_idx]
    for dy in range(-R, R + 1):
        for dx in range(-R, R + 1):
            Fs = torch.roll(Fb, (dy, dx), (2, 3)); Ms = torch.roll(Mb, (dy, dx), (1, 2)).clone()
            if dy > 0: Ms[:, :dy] = False
            if dy < 0: Ms[:, dy:] = False
            if dx > 0: Ms[:, :, :dx] = False
            if dx < 0: Ms[:, :, dx:] = False
            for s in range(0, len(bank_idx), 8):
                d2 = ((Fs[s:s + 8].float() - q.float()[None]) ** 2).sum(1)
                d2[~Ms[s:s + 8]] = float("inf")
                best = torch.minimum(best, d2.min(0).values)
    return smooth_up(torch.sqrt(best.clamp(min=0)))

@torch.no_grad()
def score_global(q, bank_idx, m=20000):
    v = FE[bank_idx].permute(0, 2, 3, 1)[GOOD[bank_idx]]
    v = v[torch.randperm(len(v), device=dev)[:m]].float()
    qq = q.float().flatten(1).T
    d = torch.cdist(qq, v).min(1).values.view(G, G)
    return smooth_up(d)

def roi_tiles(i):
    """Regions scored like seam regions: tiles holding adhesive (dark pixels) or touching a defect box."""
    g = gray[i]; bm = box_mask(i, RES); n = RES // TILE; out = []
    for ty in range(n):
        for tx in range(n):
            sl = (slice(ty * TILE, (ty + 1) * TILE), slice(tx * TILE, (tx + 1) * TILE))
            dark = (g[sl] < 90).mean(); defect = bm[sl].any()
            if dark > 0.02 or defect:
                out.append((sl, defect))
    return out

def evaluate(scorer, name):
    gkf = GroupKFold(n_splits=5)
    idx = np.arange(len(files)); rng = np.random.default_rng(0)
    rec = {"box": [], "tile_normal": [], "img": []}
    for fold, (tr, te) in enumerate(gkf.split(idx, groups=groups)):
        trg = np.unique(groups[tr]); rng.shuffle(trg)
        calg = set(trg[: max(1, len(trg) // 5)])
        cal = [i for i in tr if groups[i] in calg]; bank = [i for i in tr if groups[i] not in calg]
        calscores = []
        for i in cal:
            a = scorer(FE[i], bank).cpu().numpy()
            calscores += [float(a[sl].max()) for sl, d in roi_tiles(i) if not d]
        calscores = np.sort(np.array(calscores)); n = len(calscores)
        def thr(alpha):  # split-conformal: ceil((n+1)(1-alpha))-th smallest
            j = int(math.ceil((n + 1) * (1 - alpha))) - 1
            return float(calscores[min(j, n - 1)]) if j < n else float("inf")
        th = {"1%": thr(0.01), "0.1%": thr(0.001)}
        for i in te:
            a = scorer(FE[i], bank).cpu().numpy()
            tl = roi_tiles(i)
            for sl, d in tl:
                if not d: rec["tile_normal"].append({"s": float(a[sl].max()), "th": th})
            for c, x, y, w, h in boxes[i]:
                x0, x1 = int((x - w / 2) * RES), int(math.ceil((x + w / 2) * RES)); y0, y1 = int((y - h / 2) * RES), int(math.ceil((y + h / 2) * RES))
                rec["box"].append({"cls": c, "s": float(a[max(0, y0):y1 + 1, max(0, x0):x1 + 1].max()), "th": th, "area": w * h})
            rec["img"].append({"i": int(i), "max_normal": max([float(a[sl].max()) for sl, d in tl if not d] or [0]), "th": th})
        print(name, "fold", fold, "bank", len(bank), "cal imgs", len(cal), "cal regions", n, flush=True)
    bs = np.array([b["s"] for b in rec["box"]]); ns = np.array([t["s"] for t in rec["tile_normal"]])
    res = {"n_images": len(files), "n_groups": int(groups.max() + 1), "n_boxes": len(bs), "n_normal_regions": len(ns),
           "auroc_box_vs_normal_region": float(roc_auc_score(np.r_[np.ones(len(bs)), np.zeros(len(ns))], np.r_[bs, ns]))}
    for cls, cname in ((0, "discontinuity"), (1, "excess")):
        sel = np.array([b["cls"] == cls for b in rec["box"]])
        res[f"auroc_{cname}"] = float(roc_auc_score(np.r_[np.ones(sel.sum()), np.zeros(len(ns))], np.r_[bs[sel], ns]))
    for a in ("1%", "0.1%"):
        det = [b["s"] > b["th"][a] for b in rec["box"]]; fa = [t["s"] > t["th"][a] for t in rec["tile_normal"]]
        res[f"at_{a}"] = {"detected_all": f"{sum(det)}/{len(det)}",
                          "detected_discontinuity": f"{sum(d for d, b in zip(det, rec['box']) if b['cls'] == 0)}/{sum(b['cls'] == 0 for b in rec['box'])}",
                          "detected_excess": f"{sum(d for d, b in zip(det, rec['box']) if b['cls'] == 1)}/{sum(b['cls'] == 1 for b in rec['box'])}",
                          "false_alarm_rate_regions": round(float(np.mean(fa)), 4)}
    # upper bound, not a deployable setting: threshold just above the highest good-region score on the test folds (zero false alarms)
    top = float(ns.max()); det0 = [b["s"] > top for b in rec["box"]]
    res["zero_fa_upper_bound"] = {"detected_all": f"{sum(det0)}/{len(det0)}",
                                  "detected_discontinuity": f"{sum(d for d, b in zip(det0, rec['box']) if b['cls'] == 0)}/{sum(b['cls'] == 0 for b in rec['box'])}",
                                  "detected_excess": f"{sum(d for d, b in zip(det0, rec['box']) if b['cls'] == 1)}/{sum(b['cls'] == 1 for b in rec['box'])}"}
    return res, rec

out = {}
for name, fn in (("positional", score_positional), ("global", score_global)):
    out[name], rec = evaluate(fn, name)
    if name == "positional":
        json.dump(rec, open(os.path.join(OUT, "peres_records_positional.json"), "w"))
json.dump(out, open(os.path.join(OUT, "peres_results.json"), "w"), indent=1)
print(json.dumps(out, indent=1))
