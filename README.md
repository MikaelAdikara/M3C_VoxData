# Learning Line — concept prototype

**Concept prototype with simulated data; not connected to TMMIN systems.**

Companion to the M3C 2026 Business Executive Summary *"The Learning Line: Turning Every Abnormality into a Reusable Standard at TMMIN Karawang, 2026–2030"* (Appendix C). It shows one sealer abnormality travelling through the **Shift loop** (minutes) and the **Kaizen loop** (weeks), and where people decide at each step. AI detects and drafts; operators, team leaders and engineers decide.

## What you can do in the demo

| Screen | Who | What it proves |
|---|---|---|
| `/station` Station alert | Operator | Alert reaches the station that made the defect; operator confirms or rejects with a reason code; heatmap shows why |
| `/shift-board` Shift board | Team leader | Team leader decides stop, contain or continue; false-alarm budget per station is visible |
| `/kaizen` Kaizen cockpit | Engineer | Third repeat of a defect type opens a ticket with its data; engineer writes the A3 |
| `/knowledge` Knowledge cards + assistant | Engineer, senior expert | Senior validates the card; the assistant answers only from validated cards and cites them |
| `/metrics` Loop metrics | Management | Override rate, false alarms per station per shift, repeat defects prevented, learning cycle time |
| `/simulator` Demo control | Presenter | Inject a defect or a false alarm to drive the story live |

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in only what you need; the demo runs without any key
npm run db:seed
npm run dev
```

Open http://localhost:3000.

Environment variables (see `.env.example`):

- `DATABASE_URL`: Postgres connection string. If empty, the app uses an in-memory store seeded on start (good enough for a demo, resets on redeploy).
- `ANTHROPIC_API_KEY`: optional. Without it the assistant uses prepared answers from the same validated cards, and the UI labels them "offline mode".
- `ANTHROPIC_MODEL`: optional, default `claude-sonnet-5-5`.

Keys are entered by the team in the Vercel dashboard, never committed.

## Deploy

Push to GitHub → import the repo in Vercel → add env vars → deploy. Check the public URL from an incognito window before adding it to Appendix C.

## Docs

- `docs/PRD.md`: scope, user stories, acceptance criteria
- `docs/ARCHITECTURE.md`: stack, data model, event format, rules, assistant guardrails
- `docs/SEED_DATA.md`: every seeded number and where it comes from in the case
- `docs/DESIGN.md`: visual system (matches the Executive Summary figures)
- `docs/DEMO_SCRIPT.md`: 2–3 minute walkthrough video
- `docs/BUILD_PLAN.md`: build order for 9 October, definition of done

## Data and privacy

All images are generated illustrations of sealer beads; all numbers are simulated and anchored to the casebook's dummy exhibits. No faces, no personal names: actions are logged by role and station (for example `role:operator@st-04`), as in the Executive Summary (Figure D4).
