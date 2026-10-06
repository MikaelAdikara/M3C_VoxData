# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Production app: Next.js (App Router) + TypeScript + Tailwind v4, built by the BE side per `COLLAB.md`. Design mockups: static HTML/CSS with small vanilla JS in `design/mockup/`, so the visual system can be locked before the app exists.

## Users

Roles, never named people. Actors are logged as `role:<role>@<station>`.

- **Operator, sealer station st-04.** Stands at a station tablet or andon screen on the K2-Body line, often wearing gloves, under bright factory light, with a takt time of about 1.5 minutes. Job: decide whether an alert is a real defect and what happens next.
- **Team leader, body line.** Moves along the line with a tablet or phone. Job: decide whether to stop and fix, contain, or continue, and see which station's camera is noisy.
- **Engineer (process owner).** At a laptop. Job: understand why a defect repeats, write the A3, and turn a working countermeasure into a card.
- **Senior expert.** At a laptop. Job: check that a knowledge card is correct enough to become a standard, then validate it or return it.
- **Plant management.** At a laptop. Job: see whether the loops are working against the Gate 1 indicators.

## Product Purpose

Learning Line is the concept prototype behind the M3C 2026 Executive Summary for TMMIN Karawang. It follows one sealer abnormality from the camera to a revised standard: the camera flags a bead, the operator confirms, the team leader decides, the third repeat becomes a Kaizen ticket, the engineer's fix becomes a validated knowledge card, and the assistant cites that card. Success means a judge can repeat that story in one sentence after a 3-minute walkthrough.

## Positioning

AI detects and drafts. People decide. Every alert returns to the station that made the defect (not to final inspection), and each human decision is visible as its own step. Three loops run at different speeds: the Shift loop (minutes), the Kaizen loop (weeks) and the Launch loop (new variants).

## Operating Context

- Toyota Production System on the shop floor: andon (yellow call, red line stop), jidoka, standardized work, A3, yokoten, 4M change.
- Station screens are read at arm's length or from a distance, under fluorescent light, possibly with gloves.
- Engineers and management use laptops in offices or line-side rooms.
- The prototype runs on simulated data only and is not connected to TMMIN systems.

## Capabilities and Constraints

- Screens: Station alert, Shift board, Kaizen cockpit and A3 ticket, Knowledge cards and assistant, Loop metrics, Simulator (demo control).
- There is no automatic line stop. The system recommends and the team leader decides.
- The false-alarm budget (2 per station per shift) only flags a station for model review. It never hides confirmed defects.
- Only verified rejections may update the model, as a 4M change.
- The assistant answers only from validated cards, cites `[CARD-ID r<rev>]`, and says when no validated card covers the question.
- Numbers come only from `docs/SEED_DATA.md`.
- Terms must match the Executive Summary exactly: Shift loop, Kaizen loop, Launch loop, yellow andon, false-alarm budget, verified rejection, 4M change, validated knowledge card, A3, yokoten, team leader, senior expert, DX cell.
- UI text is in English.

## Brand Commitments

- Visual language takes its inspiration from Toyota and the shop floor, decided 2026-10-06:
  - Toyota Red appears only as a brand mark and for stop or critical states.
  - Andon colours keep their TPS meanings.
- No Toyota logo, emblem or proprietary typeface (Toyota Type is not licensable). The product is named "Learning Line" and must not look like an official Toyota product.
- Every screen carries the footer "Concept prototype · simulated data · not connected to TMMIN systems".
- No faces and no personal names.

## Evidence on Hand

- `docs/SEED_DATA.md` holds all baselines, targets, cards, tickets and assistant questions.
- `docs/DEMO_SCRIPT.md` holds the walkthrough story.
- Bead images are generated illustrations, labelled as such.
- There are no real plant photos, real users, testimonials or performance claims, and none may be invented.

## Product Principles

1. Show who decides at every step.
2. Colour speaks only when something is abnormal.
3. The station that made the defect learns first.
4. Nothing becomes a standard until a person validates it.
5. Plain words, large targets and one decision at a time on the floor.

## Accessibility & Inclusion

- WCAG AA contrast.
- Touch targets of at least 48 px; primary operator and team leader actions of 64 px or more.
- Every control reachable by keyboard with a visible focus ring.
- Colour is never the only signal: state always has a text label.
- Motion respects `prefers-reduced-motion`.
