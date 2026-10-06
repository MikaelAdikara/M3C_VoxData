# Instructions for coding agents working in this repo

This is a **concept prototype** for a business-case competition (M3C 2026, TMMIN case). Judges will open the live site and may read the code. Priorities, in order: the story works end to end, every screen shows who decides, the code is clean and readable, the UI looks like calm industrial software.

## Source of truth

- Product scope and acceptance criteria: `docs/PRD.md`
- Data model, event format, rules and assistant guardrails: `docs/ARCHITECTURE.md`
- Seed numbers: `docs/SEED_DATA.md`. Do not invent other baseline numbers; if a number is missing, ask.
- Visual system: `docs/DESIGN.md`

Terms must match the Executive Summary exactly: Shift loop, Kaizen loop, Launch loop, yellow andon, false-alarm budget, verified rejection, 4M change, validated knowledge card, A3, yokoten, team leader, senior expert, DX cell.

## Stack

Next.js (App Router) + TypeScript (strict) + Tailwind CSS. Drizzle ORM on Postgres when `DATABASE_URL` is set, otherwise the in-memory store in `lib/store/memory.ts` behind the same interface. Anthropic TypeScript SDK (`@anthropic-ai/sdk`) for the assistant, server-side only. No other paid services.

## Rules

- Never commit secrets. Read keys only from `process.env` on the server. The app must run with no keys at all (offline assistant mode).
- No automatic line stop: the system recommends; the team leader decides. Do not add any code path that changes station state without a human action.
- Confirmed defects are never suppressed or hidden by the false-alarm budget. The budget only flags a station for model review.
- The assistant answers only from cards with `status = 'validated'`. If retrieval finds nothing above the threshold, it says so and offers to route the question to the owner engineer. Every answer cites card ID and revision.
- Log actors as roles plus station (`role:operator@st-04`), never personal names. No face images anywhere.
- Every screen carries the footer label "Concept prototype · simulated data · not connected to TMMIN systems".
- Keep components small; business rules live in `lib/rules/` with unit tests (Vitest). UI never computes rules inline.
- Accessibility: touch targets ≥ 48 px on operator and team-leader screens, contrast AA, everything keyboard reachable.

## Commands

```bash
npm run dev        # local
npm run db:seed    # seed Postgres or the memory store
npm run test       # vitest for lib/rules and lib/assistant
npm run lint && npm run typecheck
```

Run `test`, `lint` and `typecheck` before every commit.

## Collaboration: UI side

This repo is built by two people with two agents. **Read `COLLAB.md` before every task. It is binding.**

- You build the **UI** only. The backend side follows `AGENTS.md`.
- You own `app/globals.css`, `app/layout.tsx`, `app/**/page.tsx`, `app/**/loading.tsx`, `app/**/error.tsx`, `app/**/not-found.tsx`, `components/**`, `public/**` (except generated `public/beads/`), `docs/DESIGN.md` and `docs/screenshots/**`.
- You **never** edit `package.json`, config files, `lib/**`, `db/**`, `app/api/**`, `scripts/**` or tests. If the UI needs a new field, action or npm package, add a row to "Request ke BE" in `COLLAB.md` §6 and tell the user.
- The UI reads data only through `lib/queries.ts`, writes only through `lib/actions/*`, and uses types from `lib/types.ts`. No business rules in components.

### When asked to work (or whether the backend has pushed)

1. Run `git fetch --all --tags && git pull --rebase origin main`, then `git tag -l 'handoff/*'` and `git log origin/main --oneline -10`.
2. Find the next UI phase in `COLLAB.md` §3 and its required `handoff/be-*` tag.
   - Missing → tell the user plainly: "Belum: `handoff/be-N` belum di-push BE. Tunggu dulu." Stop there.
   - Present → read the new entries in `COLLAB.md` §6–§7 and `lib/types.ts` / `lib/queries.ts` / `lib/actions/*`. Run `npm install && npm run typecheck`, then build the phase.
3. When finished, run `npm run lint && npm run typecheck && npm run test`. Stage only UI-owned files plus `COLLAB.md` (check `git diff --name-only --cached`). Commit with prefix `ui:`, mark the phase `DONE` in §3, then `git tag handoff/ui-N`. **Never push** unless the user explicitly says so; then `git push origin main --follow-tags`. No `Co-Authored-By: Claude` trailer in commits.
