# ml/ — st-04 sealer-bead camera model (AI-1)

A real anomaly model for the Shift loop, trained and tested on **synthetic** bead images.
It proves the workflow and the way we measure (score per seam, threshold set from the
false-alarm budget, detection per defect type at that threshold). It says nothing about
accuracy on TMMIN lines; that is measured only at Checkpoint 0 and Gate 1.

| File | What it does |
|---|---|
| `beadsynth.py` | Renders one camera crop (256 x 96) of one seam: e-coat panel, panel joint, sealer bead, lighting, sensor noise, reflections, and the five defect types of `docs/SEED_DATA.md`. Pure function of a small parameter dict. |
| `patchcore.py` | PatchCore-style model (Roth et al. 2022, simplified): frozen ImageNet ResNet-18 features, memory bank of good patches per seam, nearest-neighbour distance as the anomaly heatmap. |
| `train_eval.py` | Builds the bank, sets a threshold per seam, evaluates, exports ONNX to `public/models/` and the numbers the page shows to `lib/vision/bead-model.json`. |
| `experiment.py` | The small comparison that chose the backbone layers and bank size. |
| `parity_fixture.py` | Writes `results/parity_fixture.json`; `lib/vision/beadsynth.test.ts` checks the TypeScript twin renders the same pixels. |
| `results/` | `metrics.json` (full evaluation), `examples.png`, `experiments.jsonl`, `train_log.txt`. No image datasets are stored; every image is regenerated from its seed. |

## Run

```bash
python -m pip install -r ml/requirements.txt
python ml/train_eval.py --quick   # smoke test, ~2 min
python ml/train_eval.py           # full run + export
python ml/parity_fixture.py       # after any change to beadsynth.py
```

## Method in one paragraph

Each body has 16 sealed seams at st-04 and the line builds about 300 bodies per shift, so a
station sees 4,800 seam crops per shift. The Gate 1 budget is at most 2 false alarms per
station per shift, so each seam may flag a good crop with probability at most
2 / 4,800 = 0.042%. The threshold for each seam is the k-th largest score among 2,500 good
calibration crops with k = floor((n + 1) x 0.00042) (split-conformal rule), which bounds the
false-alarm probability of a new good crop by that value. A separate set of 40,000 good
crops estimates the false alarms per shift with a 95% Clopper-Pearson interval. Detection
is reported per defect type on 59 crops at our synthetic spec limit (the Gate 1 sample
size) and on 400 crops of random size, all at that threshold. Strong reflections that the
model never saw in training are reported separately: they are the false alarms an operator
rejects with reason REFLECTION.

## Synthetic spec limits (our assumption, not a TMMIN standard)

| Type | Limit sample | Criticality |
|---|---|---|
| BEAD_MISSING | 24 px of bead absent | Leak-critical (manual check stays) |
| BEAD_BREAK | 4 px gap | Leak-critical (manual check stays) |
| BEAD_THIN | 60% of nominal width over 20 px | Non-critical |
| BEAD_OFFSET | centre moved half a bead width + 2 px over 30 px (joint exposed) | Non-critical |
| BEAD_EXCESS | 150% of nominal width over 15 px | Non-critical |
