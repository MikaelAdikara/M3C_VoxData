"""Write ml/results/parity_fixture.json: parameters plus a pixel subsample rendered by
beadsynth.py, so lib/vision/beadsynth.test.ts can check the TypeScript twin."""
import base64
import json
import os

import numpy as np

import beadsynth as bs

HERE = os.path.dirname(os.path.abspath(__file__))

if __name__ == "__main__":
    rng = np.random.default_rng(2026)
    cases = []
    for i, d in enumerate(["none"] + bs.DEFECT_TYPES + ["glare"]):
        if d == "glare":
            p = bs.sample_params(rng, 15, strong_glare=True)
        else:
            p = bs.sample_params(rng, (i * 5) % 16, d, "random" if i % 2 else "limit")
        img = bs.render(p)
        sub = img[2::4, 1::4, :]  # rows 2,6,..; cols 1,5,..
        cases.append({"params": p, "rows": [2, 4], "cols": [1, 4], "shape": list(sub.shape),
                      "pixels": base64.b64encode(np.ascontiguousarray(sub).tobytes()).decode()})
    os.makedirs(os.path.join(HERE, "results"), exist_ok=True)
    with open(os.path.join(HERE, "results", "parity_fixture.json"), "w") as fh:
        json.dump({"width": bs.W, "height": bs.H, "cases": cases}, fh)
    print(len(cases), "cases")
