# Financial model and Monte Carlo

Evidence for Appendix A of the semifinal proposal. Inputs are the organiser's casebook exhibits (dummy data, used as given), public benchmarks and team assumptions; no TMMIN-internal data.

| File | What it is | Check |
|---|---|---|
| `LearningLine_Financial_Model.xlsx` | Five-year model (2026–2031, 10% discount rate) with ten-year life-cycle and sensitivity sheets. Blue cells are inputs; yellow cells are team assumptions to challenge. | Base NPV Rp20.761 bn |
| `mc_model.py` | Python replica of the workbook; 10,000-run Monte Carlo with independent triangular draws and a 30% chance of a one-year slip | `python mc_model.py` prints base NPV 20.761, median 10.8, 15% of runs negative |
| `decision_analysis.py` | Break-even level per driver; independent vs fully correlated Monte Carlo; value of the Gate 1 stop rule | Correlated: P(NPV>0) 69%, Gate 1 stops 28% of runs, expected loss Rp5.7 → 4.0 bn |

Double-counting rules (also on the workbook's README sheet): rework labour sits in the quality lever, not in operator non-value-added time; the downtime benefit is recovery overtime only; non-value-added time is waiting, walking and searching in normal running; engineer capacity is reported in FTE and not monetised.

The workbook's KPIs sheet dates from the Executive Summary and lists 7 months per variant in 2028; the semifinal proposal uses 8 (Section 2.4). The NPV does not depend on that target.

Requirements: Python 3.10+, standard library only.
