# Design system

Same visual language as the Executive Summary figures, so the prototype and the document read as one piece of work. Calm industrial software, not a marketing page: no gradients, no glassmorphism, no purple, no generic hero cards.

## Tokens

| Token | Value | Use |
|---|---|---|
| `navy` | #12355B | Headers, primary buttons, top bar |
| `blue` | #2A78D6 | Links, selection, Kaizen loop |
| `blue-3` | #E3EEFB | Info backgrounds |
| `orange` | #EB6834 | Alerts, yellow-andon state, Shift loop |
| `orange-3` | #FDEEE6 | Alert backgrounds |
| `teal` | #16946A | Confirmed fix, validated card, Launch loop, on-target KPI |
| `teal-3` | #E4F5EE | Success backgrounds |
| `ink` / `ink-2` / `muted` | #0B0B0B / #4A4A46 / #8A8984 | Text levels |
| `rule` / `grid` / `sand` | #C9C8C2 / #E6E5E0 / #F6F5F2 | Borders, table lines, panels |

Andon semantic colours: yellow call = `#F2B705` badge on dark text (the only yellow in the app); line stop = `#C62828` (shown only as the team leader's decision, never as an automatic state).

## Type

System sans stack `Arial, Helvetica, sans-serif` (matches the document). Operator and team-leader screens: body 18 px, numbers 28–40 px bold, buttons 20 px. Engineer screens: body 15 px. Tabular numbers (`font-variant-numeric: tabular-nums`) for all metrics.

## Layout

- Top bar: navy, product name "Learning Line", role switcher (Operator st-04 · Team leader · Engineer · Senior expert · Management), shift clock.
- Footer on every page: "Concept prototype · simulated data · not connected to TMMIN systems".
- Operator screen: one alert at a time, image left (60%), decision right; buttons at least 64 px tall, full width; no more than two choices visible at once.
- Tables follow the document style: navy header row with white text, horizontal hairlines only, numbers right-aligned.
- Charts: same palette; one message per chart; direct labels instead of legends where possible.

## Components

AlertCard (image + heatmap + score/threshold + model version) · DecisionBar · ReasonCodeSheet · StationTile (counts, budget meter, flag) · RecommendationBox (text + three decision buttons) · TicketHeader (trigger alerts, owner, status stepper) · A3Form (six blocks, AI-prefilled fields tagged "drafted by AI, check") · CardView (fields, revision history, validate/return) · AssistantPanel (answer with citation chips, no-card state) · KpiTile (value, baseline, target, source tooltip) · LoopBadge (Shift / Kaizen / Launch colours).

## Copy rules

Plain English, short verbs: "Confirm defect", "Reject: false alarm", "Stop and fix", "Contain", "Continue with check", "Request validation", "Validate card". Never "AI decided"; use "Suggested by the system" and "Decided by team leader".
