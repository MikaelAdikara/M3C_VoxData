# Build plan: 9 October 2026

Goal by evening: live URL + public (or judge-accessible) repo + 3-minute video, links in Appendix C before 10 October.

## Before 9 October (team)

- [ ] GitHub account and repo name decided (suggestion: `learning-line-prototype`); public, or private with judges invited.
- [ ] Vercel account linked to GitHub.
- [ ] Postgres: create a free Neon or Supabase project and copy `DATABASE_URL` (optional; memory store works without it).
- [ ] `ANTHROPIC_API_KEY`: the team enters it in Vercel → Project → Settings → Environment Variables. Claude never types credentials.
- [ ] Team name decided (also used on the ES cover and in the repo README footer).

## Build order

| Block | Time | Work | Done when |
|---|---|---|---|
| 1 | 08:00–09:00 | Scaffold Next.js + Tailwind + Vitest; copy `README.md`, `CLAUDE.md`, `docs/`; tokens from DESIGN.md; layout with top bar, role switcher, footer label | `npm run dev` shows empty pages for all routes |
| 2 | 09:00–10:30 | Store interface + memory store + seed (SEED_DATA.md); bead SVG generator | Seed loads; images render |
| 3 | 10:30–12:00 | `lib/rules` with tests (repeat → ticket, budget, recommendation, override rate) | `npm test` green |
| 4 | 12:00–13:30 | Station alert + Shift board + live updates (polling or SSE) | Confirm on station appears on board within 2 s |
| 5 | 13:30–15:00 | Kaizen cockpit, ticket A3 form, status flow | Inject repeat ×3 opens ticket with three alert IDs |
| 6 | 15:00–16:30 | Knowledge cards, validation flow, assistant (retrieve, guardrails, offline mode) with tests | Seed questions 1–4 behave as in SEED_DATA.md §6 |
| 7 | 16:30–17:30 | Metrics page, simulator, reset | Full story runs in < 3 min |
| 8 | 17:30–18:30 | Deploy to Vercel, env vars by team, Drizzle + Postgres if available; rate limit on `/api/assistant` | Live URL works in incognito |
| 9 | 18:30–20:00 | Record video (DEMO_SCRIPT.md), captions, upload to Drive | Video ≤ 3:00, link opens in incognito |
| 10 | 20:00–21:00 | Fill Appendix C links (and QR codes), rebuild ES, export PDF from Word, check main text ≤ 7 pages | Final PDF named `TeamName_M3C2026_Preliminary.pdf` |

## Cut list if time runs short (in this order)

1. Postgres → keep the memory store.
2. Live assistant → offline mode only (still validated-only with citations).
3. Optional Launch loop screen.
4. SSE → 2-second polling.

Never cut: human decisions on station and shift board, false-alarm budget behaviour, validated-only assistant, footer label.

## Definition of done

See `PRD.md` §5. Appendix C lists only what actually runs.
