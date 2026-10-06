---
version: 1
slug: "design-mockup-screens-html"
primary_target: "design/mockup/screens.html"
related_targets: ["design/mockup/station.html","design/mockup/shift-board.html","design/mockup/kaizen.html","design/mockup/knowledge.html","design/mockup/metrics.html"]
---

# Surface brief: Learning Line mockup (5 screens, phone + laptop)

Scope: static HTML mockup of Station alert, Shift board, Kaizen cockpit + A3 ticket, Knowledge + assistant, Loop metrics, plus a presenter page (screens.html) showing each in phone (390) and laptop (1440) frames. Visitor mode: Operate.

Audience and job: operator (confirm or reject an alert), team leader (stop and fix, contain, continue), engineer (A3, request validation), senior expert (validate card), management (Gate 1 indicators). Content only from docs/SEED_DATA.md. Constraint: red only for brand strip and stop/critical; no Toyota logo or Toyota Type.

## Direction contract

THESIS: Colour means what it means on a Japanese plant sign: red stop, yellow caution, green safe or validated, blue instruction or standard. It refuses the grey dashboard with one brand accent and KPI cards.

OWN-WORLD (updated after user requests): monochrome silver gradient ground, frosted glass surfaces, ink #252525. JIS-style safety colours do the state jobs and nothing else. Source Sans 3 for everything including IDs (no monospace), tabular numerals on one strict grid. Pill buttons, 8 px panels, ruled tables. The signature move is the sign plate: a state panel with a solid colour band, a pictogram and a plain verb ("CAUTION · Bead break"), used only where a decision is pending or a state is final. Raises: strict numeric grid (ikeda); a still base layer with only the active case above it (orienteering); bead images registered at one scale (botanical); a pending decision quiets the rest (streaming); denser ruled modules on engineer screens (Japanese density).

STORY: The visitor sees an abnormality reach the station that made it, then watches each human decision move it along the trail: operator, team leader, Kaizen ticket, validated card.

FIRST VIEWPORT: Top bar: thin red strip, "Learning Line", screen tabs, role switcher, shift clock. Under it the abnormality trail (5 steps, current one marked). Station: bead illustration with heatmap left (60%), yellow caution sign plate with region, score 0.83 vs threshold 0.61, model v1.3, and two 72 px pill buttons right. On phone the plate and buttons stack under the image.

FORM: Japanese safety signage (JIS colour semantics), position 6 on the ordered list, seed key 9dd9d578.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
