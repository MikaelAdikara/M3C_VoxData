# Seed data

All values are simulated. Baselines come from the casebook's dummy exhibits or from targets in the Executive Summary; nothing else may be invented without updating this file.

## 1. Baselines and targets shown in the UI

| Metric | Baseline | Gate 1 / 2028 | 2030 | Source label in UI |
|---|---|---|---|---|
| Scrap index (2023 = 100) | 108 | 96 | 81 | Casebook Exhibit 4; ES Table 4 |
| Defects escaping downstream (index) | 103 | 90 | 77 | Casebook Exhibit 4; ES Table 4 |
| Unplanned downtime (index) | 111 | 103 | 85 | Casebook Exhibit 4 |
| Operator non-value-added time | 22% | 18% | 14% | Casebook Exhibit 4 |
| Operators often overriding alerts | 31% | < 20% (Gate 1) | 10% | Casebook survey; ES Section 3 |
| Operators trained on data tools | 18% | 60% | 90% | Casebook survey |
| Operators saying technology helps | 54% | ≥ 75% of pilot operators (Gate 1) | n/a | Casebook survey; ES Gate 1 |
| Improvement ideas implemented | 28% | 40% | 50% | ES Table 4 |
| Engineer time on improvement | 25% | 35% | 45% | ES Table 4 |
| Critical know-how documented | 33% | 60% | 85% | Casebook; ES Table 4 |
| Repeat sealer defect types prevented in-station | new KPI | 50% | 80% | ES Table 4 |
| False alarms per station per shift | n/a | ≤ 2 | ≤ 2 | ES Gate 1 |
| Seeded limit samples per defect type | n/a | 59, all detected (non-critical); 100% + manual check (leak-critical) | n/a | ES Appendix H |
| Takt time, Karawang I and II | 1.5–1.57 min | | | ES Section 2.2 |

## 2. Plant structure (simulated)

- Line: `K2-Body` (Karawang II body line). Stations `st-01` … `st-06` sealer and body; `paint-bm` (paint body-map tablet); `final-01` (final inspection).
- Regions per body at st-04: 16 seams (`seam-L-door-01` … `seam-R-roof-16`).
- Bodies per shift: about 300 (ES Appendix D, assumption).
- Shifts: A 07:00–15:30, B 15:30–00:00 (labels only).
- Model versions: `sealer-st04-v1.2` (previous), `sealer-st04-v1.3` (live).

## 3. Defect types and reason codes

| ID | Name | Criticality |
|---|---|---|
| BEAD_BREAK | Broken bead | Leak-critical |
| BEAD_MISSING | Missing bead | Leak-critical |
| BEAD_THIN | Thin bead | Non-critical |
| BEAD_OFFSET | Bead off path | Non-critical |
| BEAD_EXCESS | Excess sealer | Non-critical |

Reject reason codes: `REFLECTION`, `VARIANT_MISMATCH`, `DIRTY_LENS`, `WITHIN_TOLERANCE`, `OTHER`.

## 4. History to seed (last 30 days)

- About 2,400 alerts across stations; confirmed vs rejected chosen so the plant override rate is **31%** at day 1 and falls to **24%** over the 30 days (shows the trend toward Gate 1 without claiming success).
- st-04 Pareto (confirmed): BEAD_THIN 38%, BEAD_OFFSET 27%, BEAD_BREAK 18%, BEAD_EXCESS 12%, BEAD_MISSING 5%.
- One station (`st-02`) above the false-alarm budget in the current shift (3 rejections, all `REFLECTION`) → shows "model review needed".
- Tickets: 6 closed (median learning cycle time 19 days), 2 open (one at `a3_in_progress`, one at `countermeasure_trial`).
- Ideas: 40 submitted, 31 answered within 7 days, 11 implemented (28%).

## 5. Knowledge cards (12)

9 validated, 2 draft, 1 retired. Examples (write all in the same field structure):

| ID | Status | Station | 4M factor | Symptom | Root cause | Countermeasure | Standard revised |
|---|---|---|---|---|---|---|---|
| KC-SEAL-014 r3 | validated | st-04 | Machine | Thin bead on door seams at shift start | Sealer viscosity high when material is cold after the overnight stop | Warm-up purge of 30 s before the first body; check gun pressure at start-up | Standardized work st-04, step 2 |
| KC-SEAL-021 r2 | validated | st-04 | Method | Bead break at seam-R-door-07 | Nozzle angle drifts after nozzle change | Angle gauge check after every nozzle change; add to change checklist | QC process chart, sealer section |
| KC-SEAL-009 r1 | validated | st-02 | Material | False alarms on new grey sealer | Lower contrast under current lighting | Add polarising filter; re-validate model as a 4M change | Inspection standard, camera set-up |
| KC-SEAL-030 r1 | draft | st-04 | Man | Offset bead after operator rotation | Hand-over misses robot path check | Pending senior validation | — |
| KC-SEAL-004 r4 | retired | st-04 | Machine | Excess sealer | Old pump regulator (replaced) | Superseded by KC-SEAL-014 | — |

Use `validated_by_role: "role:senior-expert@body"`; dates within the last 6 months.

## 6. Assistant seed questions (for threshold calibration and the demo)

1. "Thin bead at the start of shift on st-04, what do we do?" → KC-SEAL-014.
2. "Bead break near the right door after a nozzle change?" → KC-SEAL-021.
3. "Why are we getting false alarms on the grey sealer?" → KC-SEAL-009.
4. "How do we fix paint orange peel?" → no validated card → route to owner engineer.

## 7. Images

`scripts/make-beads.ts` generates SVGs: a grey panel with a seam path and a bead stroke, with variants for each defect type (gap in the stroke, thinner stroke, offset path, blob) plus a matching heatmap mask (radial gradient, orange) over the defect region. Label every image "illustration".
