# Learning Line — concept prototype

**Concept prototype with simulated data; not connected to TMMIN systems.**

Companion to the M3C 2026 Executive Summary and semifinal proposal *"The Learning Line: Turning Every Abnormality into a Reusable Standard at TMMIN Karawang, 2026–2030"* (Appendix C). Start with **Start the guided demo** on the cover (nine steps, about five minutes); `/plan` shows the proposal's roadmap, decision ladder and quarterly cash. It shows one sealer abnormality travelling through the **Shift loop** (minutes) and the **Kaizen loop** (weeks), and where people decide at each step. AI detects and drafts; operators, team leaders and engineers decide.

## What you can do in the demo

| Screen | Who | What it proves |
|---|---|---|
| `/station` Station alert | Operator | Alert reaches the station that made the defect; operator confirms or rejects with a reason code; heatmap shows why |
| `/shift-board` Shift board | Team leader | Team leader decides stop, contain or continue; false-alarm budget per station is visible |
| `/kaizen` Kaizen cockpit | Engineer | Third repeat of a defect type opens a ticket with its data; engineer writes the A3 |
| `/knowledge` Knowledge cards + assistant | Engineer, senior expert | Senior validates the card; the assistant answers only from validated cards and cites them |
| `/metrics` Loop metrics | Management | Override rate, false alarms per station per shift, repeat defects prevented, learning cycle time |
| `/signals` Line signals | Operator, team leader | Robot controller error codes (weekly Pareto) and member walk-checks (work orders); both open maintenance-owned tickets in the same Kaizen list |
| `/simulator` Demo control | Presenter | Inject a defect or a false alarm to drive the story live |

## Learning layer on existing plant tools

The Learning Line sits on tools a plant already runs and adds the learning loop. All of it is simulated here; `/events` shows the wiring under **How it plugs in**.

- **Three signal sources, three trigger rules, one Kaizen list.** Tickets and outbox events show the source and the owner role.
  - Bead alert: the third confirmed repeat of a defect at one station in a shift opens a ticket owned by the engineer. Every later confirmed repeat is logged on the open ticket.
  - Robot controller error code (`/signals`): a ticket opens when a code on one robot rises in the weekly Pareto, that is this week ≥ 5 and ≥ 2× its trailing 4-week weekly average. The rule is shown on screen. The seed has E-2210 on sealer robot 1 at st-04 at 4 this week against an average of 1.5; one demo report crosses the rule.
  - Member walk-check (`/signals`, a short tablet form): a finding opens a work order, or joins the open one for the same equipment and symptom. When the same finding comes back after its work order was closed, a ticket opens. Demo path: log a finding, close its work order, log it again.
  - Robot error code and walk-check tickets are owned by maintenance.
- **Body type from the model-detection camera.** The station screen shows the body type read by the line's existing model-detection camera, which selects the per-body-type bead model; no separate controller tap is needed.
- **Standard step** (Shift board). When a confirmed bead defect repeats in a shift, the shift board shows a correction step only if the station's revised standard (a validated card) holds it, with the source card id. The team leader runs it on the robot panel and taps **Done on robot panel** or **Not done (reason)**. The app records the tap only and never writes to line control. In the demo, a thin-bead repeat at st-04 shows the 30 s nozzle purge from card KC-SEAL-014. A sealer pressure change is in no standard, so it only shows as "ask the engineer". The repeat still opens or updates the Kaizen ticket, whatever the step did. Events: `step.shown`, `step.done`, `step.not_done`.
- **Chat notification.** With `WORKFLOW_WEBHOOK_FORMAT=chat`, escalations (yellow andon, new Kaizen ticket, standard step not done) are posted as one `{"text": …}` message each, the body a Teams or Slack incoming webhook accepts. Off by default.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in only what you need; the demo runs without any key
npm run db:seed
npm run dev
```

Open http://localhost:3000.

Environment variables (see `.env.example`):

- `DATABASE_URL`: Postgres connection string (one shared demo state). If empty, each visitor gets their own demo session kept in cookies on Vercel (serverless instances share no memory), and an in-memory store locally. `LEARNING_LINE_STORE=session|memory` overrides that choice.
- `ANTHROPIC_API_KEY`: optional. Without it the assistant uses prepared answers from the same validated cards, and the UI labels them "offline mode".
- `ANTHROPIC_MODEL`: optional, default `claude-sonnet-5-5`.
- `WORKFLOW_WEBHOOK_URL`, `WORKFLOW_WEBHOOK_SECRET`: optional delivery of outbox events (see `docs/integrations/README.md`). `WORKFLOW_WEBHOOK_FORMAT=chat` sends escalations as Teams/Slack-compatible chat messages instead of the JSON envelope.

Keys are entered by the team in the Vercel dashboard, never committed.

## Deploy

Push to GitHub → import the repo in Vercel → add env vars → deploy. Check the public URL from an incognito window before adding it to Appendix C.

## Evidence behind the proposal's numbers

| Claim in the proposal | Where to check it |
|---|---|
| NPV, Monte Carlo and the value of Gate 1 (Appendix A) | `finance/` (workbook, `mc_model.py`, `decision_analysis.py`) |
| Camera model on synthetic beads (Table 8, Appendix C) | `ml/train_eval.py`, `ml/results/metrics.json` |
| Same method on real Renault images (AutoVI) | `ml/autovi_eval.py`, `ml/results/autovi_metrics.json` |
| Same method on real adhesive beads (Peres et al., 2021) | `ml/peres_eval.py`, `ml/results/peres_metrics.json` (images not included) |
| Assistant and A3 drafter | `scripts/eval-assistant.ts`, `scripts/eval-kaizen.ts`, `eval/results/` |
| 17 acceptance checks on the live site | `scripts/qa/acceptance_live.py`, `eval/results/acceptance-live.json` |

## Docs

- `docs/PRD.md`: scope, user stories, acceptance criteria
- `docs/ARCHITECTURE.md`: stack, data model, event format, rules, assistant guardrails
- `docs/SEED_DATA.md`: every seeded number and where it comes from in the case
- `docs/DESIGN.md`: visual system (matches the Executive Summary figures)
- `docs/DEMO_SCRIPT.md`: 2–3 minute walkthrough video
- `docs/BUILD_PLAN.md`: build order for 9 October, definition of done

## Data and privacy

All images are generated illustrations of sealer beads; all numbers are simulated and anchored to the casebook's dummy exhibits. No faces, no personal names: actions are logged by role and station (for example `role:operator@st-04`), as in the Executive Summary (Figure D4).
