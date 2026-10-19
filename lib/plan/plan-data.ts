/**
 * Implementation plan shown on /plan. Every value is copied from the semifinal proposal
 * (draft v25, 19 Oct 2026: Tables 5, 6, 8 and 9) and its financial model
 * (M3C_Workplan/model/LearningLine_Financial_Model.xlsx, exported to semifinal/w1_w2_data.json).
 * Nothing here is invented: if the proposal changes, change this file and docs/SEED_DATA.md §10.
 * Rp in billions; 2025 prices unless stated; pre-tax unless stated.
 */

export const PLAN_SOURCE = "Proposal draft v25 and its financial model (19 Oct 2026)";

export interface PlanPhase {
  id: string;
  name: string;
  start: string; // quarter label, inclusive
  end: string; // quarter label, inclusive
  objective: string;
  milestones: string;
  investment: number;
  investmentNote: string;
  test: string;
}

export const QUARTERS = [
  "Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026",
  "Q1 2027", "Q2 2027", "Q3 2027", "Q4 2027",
  "Q1 2028", "Q2 2028", "Q3 2028", "Q4 2028",
  "Q1 2029", "Q2 2029", "Q3 2029", "Q4 2029",
  "Q1 2030", "Q2 2030", "Q3 2030", "Q4 2030",
] as const;

/** Cumulative net cash by quarter (benefits minus capex and opex), financial model. */
export const CUMULATIVE_CASH = [
  0.0, 0.0, 0.0, -4.79, -5.96, -8.67, -10.76, -11.76, -17.83, -22.17, -24.85, -28.0, -29.57, -27.12, -28.3, -28.92, -24.22,
  -19.58, -14.99, -10.45,
];
/** Gross benefit by quarter (Rp bn), financial model. */
export const QUARTERLY_BENEFIT = [
  0, 0, 0, 0, 0, 0.54, 0.95, 1.22, 1.76, 2.58, 3.28, 4.1, 4.83, 5.56, 6.52, 7.25, 8.79, 8.79, 8.79, 8.79,
];

export const PHASES: PlanPhase[] = [
  {
    id: "p1",
    name: "Phase 1 · Prove",
    start: "Q4 2026",
    end: "Q4 2027",
    objective: "Prove the Shift and Kaizen loops on the Karawang II line, from sealer to final inspection.",
    milestones: "Housings fitted in the year-end 2026 shutdown; Checkpoint 0 end Feb 2027; live alerts from April 2027 with the manual check in parallel; Gate 1 early Dec 2027.",
    investment: 9.2,
    investmentNote: "Rp14.5 bn with opex",
    test: "Gate 1: 100% of seeded leak-critical defects and ≥95% of other types detected; ≤2 false alarms per station per shift; override below 20%; −30% scrap on targeted defects; ≥75% of operators say the tool helps; no rise in safety incidents.",
  },
  {
    id: "p2",
    name: "Phase 2 · Standardise",
    start: "Q1 2028",
    end: "Q2 2029",
    objective: "Put both Karawang lines on one data model.",
    milestones: "Karawang II in the Lebaran 2028 window; Karawang I in H2 2028; older equipment in the first 2029 shutdown.",
    investment: 26.45,
    investmentNote: "data model, interface standard and gateways 13.8; camera on both lines 4.6; predictive maintenance 3.45; simulation capability 2.3; intralogistics 2.3",
    test: "Gate 2: plant scrap and downtime on their 2028 targets (96 and 103); revised standards and cards used in daily troubleshooting.",
  },
  {
    id: "p3",
    name: "Phase 3 · Scale",
    start: "Q3 2029",
    end: "Q4 2030",
    objective: "Run new variants through the Launch loop.",
    milestones: "First variant through the digital twin in H2 2029; five months per variant by 2030.",
    investment: 20.7,
    investmentNote: "digital twin and virtual commissioning 6.9; final-assembly checks and 3D printers 4.6; academy 4.6; intralogistics 2.3; knowledge platform 2.3",
    test: "Scrap 81, downtime 85 and five months per variant by 2030.",
  },
];

export interface Decision {
  name: string;
  when: string;
  quarter: (typeof QUARTERS)[number];
  spendBefore: string;
  mustBeTrue: string;
  ifNot: string;
  proof?: { label: string; href: string };
}

export const DECISIONS: Decision[] = [
  { name: "Approve the first release", when: "Q4 2026", quarter: "Q4 2026", spendBefore: "–", mustBeTrue: "Steering committee resolution.", ifNot: "–" },
  {
    name: "Checkpoint 0",
    when: "End Feb 2027",
    quarter: "Q1 2027",
    spendBefore: "Rp5.4 bn",
    mustBeTrue: "Camera passes shadow mode on seeded door-seam breaks; data-protection assessment and bipartite memorandum signed; finance cost baseline set.",
    ifNot: "Switch to a bought-in or 3D sensor from the contingency before any live alert, or stop.",
    proof: { label: "How the camera model is measured", href: "/cameras/model" },
  },
  {
    name: "Gate 1",
    when: "Early Dec 2027",
    quarter: "Q4 2027",
    spendBefore: "Rp14.5 bn",
    mustBeTrue: "The Gate 1 tests of Phase 1 pass, and the measured values imply a positive NPV.",
    ifNot: "Stop: loss Rp13.6 bn in present value (Rp32.4 bn had all phases been committed).",
    proof: { label: "Gate 1 indicators in this demo", href: "/metrics" },
  },
  {
    name: "Gate 2",
    when: "Mid 2029",
    quarter: "Q2 2029",
    spendBefore: "Rp51.9 bn",
    mustBeTrue: "2028 scrap and downtime targets met; cards used daily.",
    ifNot: "Fix and re-test before Phase 3.",
  },
];

export const HEADLINE = [
  { label: "Investment 2026–2030", value: "Rp56.4 bn", note: "incl. 15% contingency" },
  { label: "Gross benefit 2030", value: "Rp35.2 bn", note: "Rp26.5 bn a year after programme opex" },
  { label: "NPV at 10%, 2026–2031", value: "Rp20.8 bn", note: "incl. Rp16.6 bn residual value; Rp14.4 bn after tax; IRR 31.4%" },
  { label: "Peak cash need", value: "Rp29.6 bn", note: "Q1 2029; cumulative cash positive in 2031" },
];

export interface KpiRow {
  kpi: string;
  y2025: string;
  y2028: string;
  y2030: string;
  owner: string;
  rhythm: string;
  demo?: { label: string; href: string };
}

/** Proposal Table 8. Baselines are casebook data; 2028 and 2030 are targets. */
export const KPIS: KpiRow[] = [
  { kpi: "Time from a defect to feedback at the station that made it", y2025: "Several stations later (measured in Phase 1)", y2028: "Within one takt", y2030: "Within one takt", owner: "Quality assurance", rhythm: "Every shift", demo: { label: "Station alert", href: "/station?st=st-04" } },
  { kpi: "Days from a repeat-defect ticket to a revised standard (median)", y2025: "Measured in Phase 1", y2028: "≤28", y2030: "≤14", owner: "MTI programme office", rhythm: "Weekly ticket review", demo: { label: "Kaizen tickets", href: "/kaizen" } },
  { kpi: "Scrap / defects escaping downstream (index, 2023 = 100)", y2025: "108 / 103", y2028: "96 / 90", y2030: "81 / 77", owner: "Quality assurance", rhythm: "Monthly", demo: { label: "Metrics", href: "/metrics" } },
  { kpi: "Repeat sealer defect types prevented in-station", y2025: "New", y2028: "50%", y2030: "80%", owner: "Engineering", rhythm: "Weekly ticket review", demo: { label: "Kaizen tickets", href: "/kaizen" } },
  { kpi: "Unplanned downtime (index) / operator non-value-added time", y2025: "111 / 22%", y2028: "103 / 18%", y2030: "85 / 14%", owner: "Maintenance; production", rhythm: "Monthly" },
  { kpi: "Months of equipment modification per variant", y2025: "9", y2028: "8", y2030: "5", owner: "Production engineering", rhythm: "Per variant" },
  { kpi: "Engineer time on improvement / ideas implemented", y2025: "25% / 28%", y2028: "35% / 40%", y2030: "45% / 50%", owner: "MTI programme office", rhythm: "Quarterly", demo: { label: "Ideas at the station", href: "/station?st=st-04" } },
  { kpi: "Critical know-how documented / processes relying on 1–2 people", y2025: "33% / 48%", y2028: "60% / 30%", y2030: "85% / 15%", owner: "Senior experts; programme office", rhythm: "Quarterly", demo: { label: "Knowledge cards", href: "/knowledge" } },
  { kpi: "Engineers at level 3+ in software and AI / programming (of 30)", y2025: "2 / 6", y2028: "8 / 12", y2030: "15 / 18", owner: "Toyota Indonesia Academy", rhythm: "Yearly" },
  { kpi: "Energy per vehicle (2027 = 100), lower as fewer bodies are reworked or scrapped", y2025: "Measured from 2027", y2028: "98", y2030: "95", owner: "Facilities", rhythm: "Monthly" },
  { kpi: "Operators overriding alerts / trained on data tools", y2025: "31% / 18%", y2028: "15% / 60%", y2030: "10% / 90%", owner: "Team leaders; HR", rhythm: "Every shift; quarterly", demo: { label: "Override rate", href: "/metrics" } },
  { kpi: "Underlying conversion cost saving, 2025 prices (excl. avoided equipment spend and wage escalation)", y2025: "–", y2028: "2.0%", y2030: "4.8%", owner: "Finance with plant head", rhythm: "Monthly; verified at gates" },
];

export interface Lever {
  lever: string;
  loop: string;
  value: number;
  anchor: string;
  breakEven: string;
}

/** Proposal Table 9: 2030 run-rate by lever and where the NPV turns zero. */
export const LEVERS: Lever[] = [
  { lever: "Quality", loop: "Shift loop", value: 11.2, anchor: "Lighthouse plants cut defects 20–50% (WEF 2023, 2025); we use 25%.", breakEven: "Scrap share 1.8% (plan 8%) or reduction 5.5% (plan 25%)" },
  { lever: "Maintenance and downtime", loop: "Foundation", value: 6.4, anchor: "8–12% saving over preventive maintenance (US DOE); 23% less downtime, near the low end of published cuts.", breakEven: "Not reached: NPV Rp7.5 bn without this lever" },
  { lever: "Labour", loop: "Shift loop, Foundation", value: 11.6, anchor: "Renault Curitiba cut non-value-added activities 19% (WEF 2019), half our 36%; at that rate the lever is Rp6.1 bn. No published anchor for the 70% cash share.", breakEven: "Cash share 15.2% (plan 70%); 29% at Renault's rate" },
  { lever: "Flexibility", loop: "Launch loop", value: 6.0, anchor: "Toyota's digital twin targets −50% equipment investment (Toyota Motor Europe 2023); we use 40% of it.", breakEven: "Not reached: NPV Rp10.7 bn without this lever" },
];
