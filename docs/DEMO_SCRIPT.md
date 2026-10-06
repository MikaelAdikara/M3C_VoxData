# Demo script: walkthrough video (target 2:45, hard limit 3:00)

Record at 1920×1080 on the live URL after **Reset demo**. Voice-over in English, calm pace. No faces, no university names or logos. Captions on.

| Time | Screen | Action on screen | Voice-over |
|---|---|---|---|
| 0:00–0:15 | Title card | "Learning Line · concept prototype, simulated data" | "This is the Learning Line prototype for TMMIN Karawang. It follows one sealer defect from the camera to a revised standard, and shows who decides at each step." |
| 0:15–0:40 | `/simulator` → `/station?st=st-04` | Inject true defect. Alert appears: bead image, orange heatmap on seam-R-door-07, score 0.83 vs threshold 0.61, model v1.3 | "A repurposed camera checks every bead. The model was trained only on good beads, so it flags anything that departs from them and shows where. The alert goes to the station that made the defect, not to final inspection." |
| 0:40–0:55 | Station | Operator taps **Confirm defect** | "The operator confirms. A false alarm would be rejected with a reason, and only rejections verified by the team leader can ever update the model, as a controlled 4M change." |
| 0:55–1:20 | `/shift-board` | Yellow andon on st-04; recommendation "Stop and fix: leak-critical"; team leader taps **Stop and fix**, note "nozzle check". Point at st-02 "model review needed" | "The team leader sees a yellow andon call and a suggestion. The system never stops the line; the team leader does. Station 2 is over its false-alarm budget of two per shift, so its model goes to review, but confirmed defects are never hidden." |
| 1:20–1:45 | `/simulator` → `/kaizen` | Inject repeat ×3 → ticket opens with three alert IDs, gun pressure trend | "The third repeat in a shift opens a Kaizen ticket with its data already attached. The engineer goes to the line and writes the A3; the AI only pre-fills the background." |
| 1:45–2:15 | `/knowledge` | Engineer requests validation; senior expert validates KC-SEAL-021 → revision 3, standardized work updated | "A working countermeasure becomes a validated knowledge card and revises the standard. Yokoten carries it to every station running the same process." |
| 2:15–2:35 | `/knowledge` assistant | Ask "Bead break near the right door after a nozzle change?" → answer with [KC-SEAL-021 r3]. Ask "paint orange peel?" → "No validated card covers this" + Route to owner engineer | "The assistant answers only from validated cards and cites them. When no card exists, it says so." |
| 2:35–2:50 | `/metrics` | Gate 1 panel: false alarms per station, override 31% → 24%, learning cycle time | "Management watches the Gate 1 indicators: false alarms, override rate, detection on seeded samples, and how fast a problem becomes a standard." |
| 2:50–3:00 | End card | Repo URL, "concept prototype, simulated data" | "AI detects and drafts. People decide." |

Checklist after recording: length ≤ 3:00, terms identical to the Executive Summary, Drive link set to "anyone with the link can view", opened from incognito.
