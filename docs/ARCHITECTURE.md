# Architecture

Mirrors the reference architecture in the Executive Summary (Figures D3–D6) at prototype scale.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router), TypeScript strict, Tailwind | One repo, server actions, free Vercel deploy |
| Data | Drizzle ORM + Postgres (Neon or Supabase free tier) via `DATABASE_URL`; in-memory fallback | Demo never breaks if the database is missing |
| AI | `@anthropic-ai/sdk`, server-only route `/api/assistant`, model from `ANTHROPIC_MODEL` | Assistant grounded in validated cards |
| Retrieval | Keyword + field scoring over cards (BM25-style), no vector DB | Small corpus (≈ 12 cards), fully explainable |
| Tests | Vitest | Rules and guardrails are the claims judges will probe |
| Images | Generated SVG bead illustrations with defect masks (`scripts/make-beads.ts`) | No real plant images |

## 2. Folder layout

```
app/
  station/page.tsx       shift-board/page.tsx   kaizen/page.tsx   kaizen/[id]/page.tsx
  knowledge/page.tsx     metrics/page.tsx       simulator/page.tsx
  api/assistant/route.ts api/events/route.ts    (server actions live next to pages)
components/              ui primitives + domain components (AlertCard, HeatmapImage, StationTile, A3Form, CardView)
lib/
  store/                 index.ts (interface) · memory.ts · drizzle.ts
  rules/                 repeat.ts · budget.ts · recommend.ts · metrics.ts  (+ *.test.ts)
  assistant/             retrieve.ts · prompt.ts · offline.ts  (+ *.test.ts)
  namespace.ts           UNS topic helpers (Figure D4)
db/ schema.ts · seed.ts
public/beads/            generated images and masks
docs/
```

## 3. Data model

```
stations(id, line, area, name, type)                 -- st-01..st-06 sealer/body, paint-bm, final-01
defect_types(id, name, criticality)                  -- BEAD_BREAK (leak-critical), BEAD_MISSING (leak-critical),
                                                     -- BEAD_THIN, BEAD_OFFSET, BEAD_EXCESS (non-critical)
alerts(id, station_id, body_id, roi, defect_type_id?, anomaly_score, threshold, model_version,
       image, mask, created_at, status)              -- status: open | confirmed | rejected | closed
decisions(id, alert_id, actor_role, kind, reason_code?, note?, created_at)
                                                     -- kind: confirm | reject | stop_fix | contain | continue
tickets(id, station_id, defect_type_id, trigger_alert_ids[], owner_role, status, a3 jsonb, created_at, closed_at)
cards(id, revision, status, process, station_ids[], variants[], factor_4m, symptom, root_cause,
      countermeasure, standard_revised, validated_by_role?, validated_at?, source_ticket_id?)
ideas(id, station_id, text, status, created_at, answered_at?)
model_reviews(id, station_id, alert_ids[], status)   -- queue of verified rejections (4M change candidates)
```

## 4. Rules (`lib/rules`, all unit tested)

- **Repeat → ticket**: when a decision confirms an alert, count confirmed alerts with the same `station_id` and `defect_type_id` in the current shift. On the third, open a ticket if none is open for that pair. Attach the three alert IDs.
- **False-alarm budget**: rejected alerts per station per shift; budget = 2. Over budget → station flagged `model_review_needed`, rejected alerts added to `model_reviews`. Never hides or downgrades confirmed alerts.
- **Verified rejection**: a rejection becomes "verified" only when a team leader or the DX cell marks the review item verified. Only verified rejections may be used to update the model (show the 4M change note; no actual retraining in the MVP).
- **Recommendation (team leader)**:
  - leak-critical type (BEAD_BREAK, BEAD_MISSING) → "Stop and fix: leak-critical; body held for repair";
  - second confirmed repeat in the shift → "Contain: check the last N bodies at this station";
  - otherwise → "Continue with check: repair at station, monitor".
  The recommendation is text only. The decision is a human action.
- **Override rate** = rejected ÷ (confirmed + rejected) per station and plant, per shift and rolling 7 days.
- **Learning cycle time** = days from the first alert of a ticket to `cards.validated_at`.

## 5. Event format (Figure D4)

Each alert is also emitted as a UNS-style event on `/api/events` (server-sent events) so the shift board and metrics update live:

```json
{
  "topic": "spBv1.0/K2-Body/DDATA/sealer-edge-04/cam-01",
  "timestamp": "2027-03-14T08:42:17.412+07:00",
  "metrics": {
    "body_id": "K2-27-031487", "roi": "seam-R-door-07",
    "anomaly_score": 0.83, "threshold": 0.61, "model_version": "sealer-st04-v1.3",
    "heatmap_ref": "/beads/031487-07-mask.svg",
    "decision": "confirmed", "reason_code": null, "decided_by": "role:operator@st-04"
  }
}
```

## 6. Assistant guardrails (Figure D6b)

1. Retrieve from `cards` where `status = 'validated'` only. Score = keyword overlap on symptom, root cause, countermeasure, process and station, with boosts for station and variant match.
2. If top score < threshold (calibrate on seed questions; start at 0.35 of max) → return the no-card response and a **Route to owner engineer** action. Do not call the model.
3. Otherwise send the top 3 cards to the model with a system prompt that: answers only from the supplied cards; cites every claim as `[CARD-ID r<revision>]`; says what is not covered; never gives a line-stop instruction (that is the team leader's call).
4. Validate the response server-side: every citation must be one of the supplied cards; if not, fall back to the offline answer.
5. Offline mode (no key or API error): return the matching card's countermeasure verbatim with its citation, labelled "offline mode".

## 7. Security and privacy

Server-only secrets; no client exposure of `ANTHROPIC_API_KEY`. Role switcher instead of accounts (demo). No personal data stored. Rate-limit `/api/assistant` (e.g. 20 requests per minute per IP) to protect the key on a public URL.
