# AGENTS.md: backend collaboration rules

This file is for whoever works on the **backend** of this repo. The UI is built by the UI side.

Read these before every task, in this order:

1. `COLLAB.md`: file ownership, the BE↔UI contract, phases, handoff procedure. **This file is binding.**
2. `CLAUDE.md`, sections "Source of truth", "Stack", "Rules" and "Commands": product rules that apply to backend and UI alike. The "Collaboration" section at the bottom is for the UI side and can be skipped.
3. `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/SEED_DATA.md`.

## Your scope

You own `package.json`, all config files, `lib/**`, `db/**`, `app/api/**`, `scripts/**`, `**/*.test.ts`, `.env.example` and the Vercel setup.

You **never** create, edit or delete `app/globals.css`, `app/layout.tsx`, `app/**/page.tsx`, `app/**/loading.tsx`, `app/**/error.tsx`, `components/**`, `public/**` (except generated `public/beads/`), `docs/DESIGN.md` or `docs/screenshots/**`. The one exception is the plain stubs you create in phase BE-0.

If the UI needs to change, add a row to "Request ke UI" in `COLLAB.md` §6. Do not edit the UI yourself.

## Before starting any phase

```bash
git fetch --all --tags && git pull --rebase origin main
git tag -l 'handoff/*'
```

Check the "Butuh" column in `COLLAB.md` §3. If the required `handoff/ui-*` tag is missing, stop and report: "Waiting for UI: handoff/ui-N not pushed yet."

## Finishing a phase

1. Run `npm run lint && npm run typecheck && npm run test`. All must pass.
2. Stage only files you own, plus `COLLAB.md`. Check with `git diff --name-only --cached`.
3. Commit with prefix `be:`. Set the phase row in `COLLAB.md` §3 to `DONE`.
4. Log any change to `lib/types.ts`, `lib/queries.ts` or `lib/actions/*` in `COLLAB.md` §7.
5. Run `git tag -a handoff/be-N -m "BE-N done" && git push origin main && git push origin handoff/be-N` (push the tag explicitly; `--follow-tags` skips lightweight tags).

## Contract reminders

- Server Actions live in `lib/actions/*.ts` (`'use server'`), never inside `app/`.
- Every action returns `{ ok: true } | { ok: false; error: string }` and calls `revalidatePath` itself.
- Business rules live in `lib/rules/` with Vitest tests. The UI never computes rules.
- Keep view models shaped for the screen (see `COLLAB.md` §2.1) so the UI does no data shaping.
