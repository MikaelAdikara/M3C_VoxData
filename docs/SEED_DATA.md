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

The BE-4 prototype generator is `scripts/generate-pilot-assets.mjs`. It writes deterministic SVGs and illustrative overlays for BEAD_THIN, BEAD_MISSING, BEAD_OFFSET and false-alarm REFLECTION into the separate local `M3C-Pilot-Data/generated/` workspace. It does not publish files into application `public/`; UI-4 owns that review and placement. These overlays are not trained-model ground truth. Alert `image`/`mask` stay empty until approved public assets exist, and `visualScenarioId` identifies the intended scene.

## 8. BE-4 operational seed and provenance

- `SEED_VERSION = "m3c-gate1-v1"`. The canonical reset snapshot has a stable SHA-256 fingerprint and a reference clock of 14 Mar 2027 08:45 WIB. The fingerprint is computed from canonically sorted JSON keys and survives a JSONB round trip.
- The simulated K2-Body production counter starts at **68 bodies completed**; ~300 per shift is an ES Appendix D assumption, and 1.5 min takt is the lower bound of the ES Section 2.2 range. The counter is not MES data. UI may advance it through the backend action only while the line is running.
- The line is running at reset. st-05 has an operator-confirmed alert awaiting a team-leader decision. Injecting and confirming the st-04 bead-break alert creates its yellow andon; a team-leader `stop_fix` decision then stops the simulated line. Restart requires a team-leader repair note.
- Eight camera endpoints are seeded across st-01…st-06, the paint body-map tablet, and final inspection. st-02 needs attention because of the reflection/false-alarm review. st-06 has a recording gap from 06:12 and is offline. The paint tablet has no CCTV stream.
- Historical alert decisions supply the simulated 30-day override trajectory, approximately 31% on the first day to 24% on the final day. The **31% baseline** is case data from the Casebook survey; the subsequent trajectory is simulation, not measured pilot improvement. The 59 limit samples per defect type remain a Gate 1 target and have **not** been evaluated by a trained model.
- Approved public visuals are mapped as `good → NORMAL`, `gap → BEAD_BREAK` visual reference only, and `overlap → BEAD_EXCESS` visual reference only. `bead_rolloff`, `bead_falloff`, `not_adhered`, `nozzle_drag`, and `swirl` stay external-only or require domain review. Public visuals do not affect alerts, KPI values, or model-performance claims.
- Landing mockup figures that are absent from the case/ES seed table above (such as 106, 19.1%, and 9 to ~5 months) require source verification before UI-4 labels them case data. BE-4's overview ledger exposes only documented case and target values.
