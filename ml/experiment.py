"""Compare model settings on a 4-seam subset: how many limit samples score above the
highest good crop of their seam (a proxy for detection at a very low false-alarm rate).
Used once to choose the shipped configuration; results are in ml/results/experiments.jsonl.

    python ml/experiment.py '[{"layers":[2,3],"bank":512,"scale":1}]'
"""
import json
import os
import sys
import time
from multiprocessing import Pool

import numpy as np

import beadsynth as bs
import train_eval as te

SEAMS = [0, 5, 10, 15]

if __name__ == "__main__":
    import torch
    from sklearn.metrics import roc_auc_score

    from patchcore import PatchCore, greedy_coreset, to_tensor

    configs = json.loads(sys.argv[1])
    out = open(os.path.join(te.RESULTS, "experiments.jsonl"), "a")
    with Pool(10) as pool:
        for cfg in configs:
            t0 = time.time()
            model = PatchCore(tuple(cfg["layers"]), proj_dim=cfg.get("proj"), bank_size=cfg["bank"], scale=cfg["scale"]).cuda().eval()
            with torch.no_grad():
                for s in SEAMS:
                    feats = []
                    for arr, _ in te.batches(pool, te.make_params("train", cfg.get("train", 60), seams=[s]), 32):
                        f = model.features(to_tensor(arr, "cuda"))
                        feats.append(f.flatten(2).transpose(1, 2).reshape(-1, f.shape[1]))
                    model.bank[s] = greedy_coreset(torch.cat(feats), cfg["bank"])
            good = te.make_params("cal", 1000, seams=SEAMS)
            gs = te.score_all(model, pool, good, "cuda")
            gseam = np.array([p["seam"] for p in good])
            gmax = {s: gs[gseam == s].max() for s in SEAMS}
            row = {"cfg": cfg}
            for d in bs.DEFECT_TYPES:
                rng = np.random.default_rng([5, bs.DEFECT_TYPES.index(d)])
                lim = [bs.sample_params(rng, SEAMS[i % 4], d, "limit") for i in range(80)]
                ls = te.score_all(model, pool, lim, "cuda")
                det = sum(int(ls[i] > gmax[p["seam"]]) for i, p in enumerate(lim))
                auroc = roc_auc_score(np.r_[np.zeros(len(gs)), np.ones(len(ls))], np.r_[gs, ls])
                row[d] = {"limit_over_max_good": det, "n": len(lim), "auroc": round(float(auroc), 4)}
            row["sec"] = round(time.time() - t0)
            print(json.dumps(row), flush=True)
            out.write(json.dumps(row) + "\n")
            out.flush()
