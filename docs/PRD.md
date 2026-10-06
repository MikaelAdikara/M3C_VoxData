# PRD: Learning Line concept prototype

## 1. Purpose

Show judges, in a 2–3 minute video and a live site, how one sealer abnormality moves from camera to revised standard, and that people make every decision. This backs Section 2.2 and Appendix C of the Executive Summary and the designs in Figures 3, D4, D5, D6 and H1.

Success = a judge who opens the site can repeat the story in one sentence: *"The camera flags a bead, the operator confirms, the team leader decides, the third repeat becomes a ticket, the engineer's fix becomes a validated card, and the assistant cites it."*

## 2. Users (roles, not people)

| Role | Device in the story | Main question |
|---|---|---|
| Operator, sealer station st-04 | Station tablet / andon screen | Is this alert real, and what do I do now? |
| Team leader, body line | Tablet | Do I stop, contain or continue? Which station is noisy? |
| Engineer (owner of the process) | Laptop | Why does this repeat, and what is the countermeasure? |
| Senior expert | Laptop | Is this card correct enough to become a standard? |
| Plant management | Laptop | Are the loops working (Gate 1 indicators)? |

## 3. Scope

### In scope (must run on the deployed site)

**S1 Station alert (`/station?st=st-04`)**
- Shows the latest open alert for the station: generated bead image, heatmap overlay on the suspect region, region name (e.g. `seam-R-door-07`), anomaly score and threshold side by side, model version.
- Big buttons: **Confirm defect** and **Reject (false alarm)**. Reject requires a reason code (reflection, variant mismatch, dirty lens, bead within tolerance, other).
- After decision, shows what happens next: confirmed → yellow andon to team leader; rejected → queued for verified-rejection review.
- **Suggest an improvement** button: free text, max 280 chars, creates an idea with status `submitted`; the operator sees the reply deadline (7 days).
- Acceptance: decision is stored with `role:operator@st-04`, timestamp and reason; the shift board updates within 2 seconds (polling is fine).

**S2 Shift board (`/shift-board`)**
- Station grid for the body line (st-01 to st-06 plus paint body-map and final inspection): open alerts, confirmed and rejected counts this shift, false alarms vs budget (2 per station per shift), override rate.
- For a confirmed alert: recommendation text (rule-based, see ARCHITECTURE §4) and three buttons **Stop and fix**, **Contain**, **Continue with check**. The decision and a one-line note are logged.
- A station over its false-alarm budget shows "model review needed"; confirmed defects stay visible regardless.
- Acceptance: team leader decision required before an alert can close; no button triggers a line stop by itself.

**S3 Kaizen cockpit (`/kaizen`)**
- Pareto of confirmed defect types (last 30 days, seeded) and open tickets.
- Rule: the third confirmed repeat of the same defect type at the same station within one shift opens a ticket automatically with attached data (alerts, images, gun flow and pressure trend, variant, shift).
- Ticket view: A3 form with background (pre-filled by data, editable), current condition, root cause, countermeasure, check, standardise. The engineer writes root cause and countermeasure; the AI may only pre-fill background and data (label it).
- **Request validation** sends the draft card to the senior expert.
- Acceptance: ticket shows its trigger (three alert IDs) and its owner role; status flow `open → a3_in_progress → countermeasure_trial → validated → closed`.

**S4 Knowledge cards and assistant (`/knowledge`)**
- Card list with filter by process, station, status (draft, validated, retired). Card fields as in Figure D6: process, station, variants covered, 4M factor, symptom, root cause, countermeasure, standard revised, validated by, revision, date.
- Senior expert can **Validate** (creates revision n+1, sets `validated_by`), or **Return with comment**.
- Assistant panel: question box. Answers only from validated cards, cites `card ID · revision`, and says "No validated card covers this" when retrieval is below threshold, offering **Route to owner engineer**.
- Acceptance: draft and retired cards never appear in assistant citations (unit tested); offline mode works without API key.

**S5 Loop metrics (`/metrics`)**
- Gate 1 panel: false alarms per station per shift (target ≤ 2), override rate (baseline 31%, Gate 1 < 20%, 2030 10%), detection on seeded limit samples (59 per type, see Appendix H), targeted scrap reduction (target −30%), operators saying the tool helps (target ≥ 75%).
- Learning cycle time: days from first alert to validated card (median of seeded tickets).
- Ideas: submitted, answered within 7 days, implemented (baseline 28%).
- Acceptance: every number shows its baseline source ("Casebook Exhibit 6", "Pilot target") on hover.

**S6 Simulator (`/simulator`)**
- Buttons: **Inject true defect** (bead break at st-04), **Inject false alarm** (reflection), **Inject repeat x3** (to trigger a ticket), **Reset demo**.
- Acceptance: the full story can be run in under 3 minutes from a reset.

### Out of scope (say so in README)

Real camera input and real anomaly model training (planned for the semifinal: PatchCore on bead images), MES/PLC integration, authentication beyond a role switcher, Launch loop beyond one static screen (optional S7: "reused vs new" checklist for a new variant).

## 4. Non-functional

- Works on a 10-inch tablet (operator, team leader) and a laptop.
- First load under 2 s on Vercel; no blocking API calls on page load.
- English UI, plain words, large type on operator screens.
- Footer label on every page: "Concept prototype · simulated data · not connected to TMMIN systems".

## 5. Definition of done

1. Live URL opens in incognito; repo link works.
2. Demo script (`docs/DEMO_SCRIPT.md`) runs end to end on the live URL after **Reset demo**.
3. Tests pass for `lib/rules` (repeat → ticket, budget flag, override rate) and `lib/assistant` (validated-only retrieval, no-card response, citation format).
4. No secrets in the repo; app runs without any key.
5. Terms and numbers match the Executive Summary.
