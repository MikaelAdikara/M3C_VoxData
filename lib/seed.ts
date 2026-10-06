import type {
  Alert,
  Decision,
  DefectType,
  DefectTypeId,
  Idea,
  KnowledgeCard,
  Station,
  StoreSnapshot,
  Ticket,
} from "@/lib/types";

const DAY_MS = 86_400_000;
const SEED_NOW = Date.parse("2027-03-14T08:45:00.000+07:00");

export const stations: Station[] = [
  { id: "st-01", line: "K2-Body", area: "Body", name: "Sealer 01", type: "sealer" },
  { id: "st-02", line: "K2-Body", area: "Body", name: "Sealer 02", type: "sealer" },
  { id: "st-03", line: "K2-Body", area: "Body", name: "Body 03", type: "body" },
  { id: "st-04", line: "K2-Body", area: "Body", name: "Sealer 04", type: "sealer" },
  { id: "st-05", line: "K2-Body", area: "Body", name: "Body 05", type: "body" },
  { id: "st-06", line: "K2-Body", area: "Body", name: "Body 06", type: "body" },
  { id: "paint-bm", line: "K2-Body", area: "Paint", name: "Paint body map", type: "paint" },
  { id: "final-01", line: "K2-Body", area: "Final", name: "Final inspection", type: "final_inspection" },
];

export const defectTypes: DefectType[] = [
  { id: "BEAD_BREAK", name: "Broken bead", criticality: "leak_critical" },
  { id: "BEAD_MISSING", name: "Missing bead", criticality: "leak_critical" },
  { id: "BEAD_THIN", name: "Thin bead", criticality: "non_critical" },
  { id: "BEAD_OFFSET", name: "Bead off path", criticality: "non_critical" },
  { id: "BEAD_EXCESS", name: "Excess sealer", criticality: "non_critical" },
];

function historyAlert(index: number): Alert {
  const day = Math.floor(index / 80);
  const withinDay = index % 80;
  const rejectedPerDay = Math.round(25 - (day * 6) / 29);
  const station = stations[index % stations.length];
  const isRejected = withinDay < rejectedPerDay;
  const defectTypeId = defectTypes[(index * 3) % defectTypes.length].id;
  const createdAt = new Date(SEED_NOW - (30 - day) * DAY_MS - (80 - withinDay) * 45_000).toISOString();

  return {
    id: `alert-history-${String(index + 1).padStart(4, "0")}`,
    stationId: station.id,
    bodyId: `K2-27-${String(index + 1).padStart(6, "0")}`,
    roi: `seam-${index % 2 === 0 ? "L" : "R"}-door-${String((index % 16) + 1).padStart(2, "0")}`,
    defectTypeId,
    anomalyScore: Number((0.62 + (index % 29) / 100).toFixed(2)),
    threshold: 0.61,
    modelVersion: day < 15 ? "sealer-st04-v1.2" : "sealer-st04-v1.3",
    image: `/beads/${defectTypeId.toLowerCase()}.svg`,
    mask: `/beads/${defectTypeId.toLowerCase()}-mask.svg`,
    createdAt,
    status: isRejected ? "rejected" : "confirmed",
  };
}

function createHistoricalAlerts(): Alert[] {
  const alerts = Array.from({ length: 2_395 }, (_, index) => historyAlert(index));
  const st04Confirmed = alerts.filter(
    (alert) => alert.stationId === "st-04" && alert.status === "confirmed",
  );
  const counts = [
    Math.round(st04Confirmed.length * 0.38),
    Math.round(st04Confirmed.length * 0.27),
    Math.round(st04Confirmed.length * 0.18),
    Math.round(st04Confirmed.length * 0.12),
  ];
  const weightedDefects = [
    ...Array<DefectTypeId>(counts[0]).fill("BEAD_THIN"),
    ...Array<DefectTypeId>(counts[1]).fill("BEAD_OFFSET"),
    ...Array<DefectTypeId>(counts[2]).fill("BEAD_BREAK"),
    ...Array<DefectTypeId>(counts[3]).fill("BEAD_EXCESS"),
    ...Array<DefectTypeId>(st04Confirmed.length - counts.reduce((sum, count) => sum + count, 0)).fill(
      "BEAD_MISSING",
    ),
  ];

  st04Confirmed.forEach((alert, index) => {
    alert.defectTypeId = weightedDefects[index];
    alert.image = `/beads/${weightedDefects[index].toLowerCase()}.svg`;
    alert.mask = `/beads/${weightedDefects[index].toLowerCase()}-mask.svg`;
  });

  return alerts;
}

const currentAlerts: Alert[] = [
  ...Array.from({ length: 3 }, (_, index): Alert => ({
    id: `alert-st02-reflection-${index + 1}`,
    stationId: "st-02",
    bodyId: `K2-27-03148${index + 1}`,
    roi: "seam-L-door-03",
    defectTypeId: "BEAD_THIN",
    anomalyScore: 0.64 + index * 0.01,
    threshold: 0.61,
    modelVersion: "sealer-st04-v1.3",
    image: "/beads/reflection.svg",
    mask: "/beads/reflection-mask.svg",
    createdAt: new Date(SEED_NOW - (25 - index) * 60_000).toISOString(),
    status: "rejected",
  })),
  {
    id: "alert-st05-confirmed-001",
    stationId: "st-05",
    bodyId: "K2-27-031486",
    roi: "seam-L-roof-12",
    defectTypeId: "BEAD_OFFSET",
    anomalyScore: 0.72,
    threshold: 0.61,
    modelVersion: "sealer-st04-v1.3",
    image: "/beads/bead_offset.svg",
    mask: "/beads/bead_offset-mask.svg",
    createdAt: new Date(SEED_NOW - 8 * 60_000).toISOString(),
    status: "confirmed",
  },
  {
    id: "alert-st04-open-001",
    stationId: "st-04",
    bodyId: "K2-27-031487",
    roi: "seam-R-door-07",
    defectTypeId: "BEAD_BREAK",
    anomalyScore: 0.83,
    threshold: 0.61,
    modelVersion: "sealer-st04-v1.3",
    image: "/beads/bead_break.svg",
    mask: "/beads/bead_break-mask.svg",
    createdAt: "2027-03-14T08:42:17.412+07:00",
    status: "open",
  },
];

const currentDecisions: Decision[] = Array.from({ length: 3 }, (_, index) => ({
  id: `decision-st02-reflection-${index + 1}`,
  alertId: `alert-st02-reflection-${index + 1}`,
  actor: "role:operator@st-02",
  kind: "reject",
  reasonCode: "reflection",
  createdAt: new Date(SEED_NOW - (24 - index) * 60_000).toISOString(),
}));

const emptyA3 = {
  background: "",
  currentCondition: "",
  rootCause: "",
  countermeasure: "",
  check: "",
  standardise: "",
};

function createTickets(): Ticket[] {
  return [
    ...Array.from({ length: 6 }, (_, index): Ticket => ({
      id: `KZ-SEAL-${String(index + 1).padStart(3, "0")}`,
      stationId: "st-04",
      defectTypeId: defectTypes[index % defectTypes.length].id,
      triggerAlertIds: [`alert-history-${String(index * 3 + 1).padStart(4, "0")}`],
      ownerRole: "role:engineer@body",
      status: "closed",
      a3: emptyA3,
      createdAt: new Date(SEED_NOW - (50 - index) * DAY_MS).toISOString(),
      closedAt: new Date(SEED_NOW - (31 - index) * DAY_MS).toISOString(),
    })),
    {
      id: "KZ-SEAL-007",
      stationId: "st-04",
      defectTypeId: "BEAD_THIN",
      triggerAlertIds: ["alert-history-2301", "alert-history-2309", "alert-history-2317"],
      ownerRole: "role:engineer@body",
      status: "a3_in_progress",
      a3: { ...emptyA3, background: "Three thin-bead alerts at st-04 in shift A." },
      createdAt: new Date(SEED_NOW - 4 * DAY_MS).toISOString(),
    },
    {
      id: "KZ-SEAL-008",
      stationId: "st-02",
      defectTypeId: "BEAD_OFFSET",
      triggerAlertIds: ["alert-history-2322", "alert-history-2330", "alert-history-2338"],
      ownerRole: "role:engineer@body",
      status: "countermeasure_trial",
      a3: emptyA3,
      createdAt: new Date(SEED_NOW - 8 * DAY_MS).toISOString(),
    },
  ];
}

function createCards(): KnowledgeCard[] {
  const examples: KnowledgeCard[] = [
    {
      id: "KC-SEAL-014",
      revision: 3,
      status: "validated",
      process: "Sealer",
      stationIds: ["st-04"],
      variants: ["K2"],
      factor4M: "Machine",
      symptom: "Thin bead on door seams at shift start",
      rootCause: "Sealer viscosity high when material is cold after the overnight stop",
      countermeasure: "Warm-up purge of 30 s before the first body; check gun pressure at start-up",
      standardRevised: "Standardized work st-04, step 2",
      validatedByRole: "role:senior_expert@body",
      validatedAt: "2027-02-20T09:00:00.000+07:00",
    },
    {
      id: "KC-SEAL-021",
      revision: 2,
      status: "validated",
      process: "Sealer",
      stationIds: ["st-04"],
      variants: ["K2"],
      factor4M: "Method",
      symptom: "Bead break at seam-R-door-07",
      rootCause: "Nozzle angle drifts after nozzle change",
      countermeasure: "Angle gauge check after every nozzle change; add to change checklist",
      standardRevised: "QC process chart, sealer section",
      validatedByRole: "role:senior_expert@body",
      validatedAt: "2027-01-28T09:00:00.000+07:00",
    },
    {
      id: "KC-SEAL-009",
      revision: 1,
      status: "validated",
      process: "Sealer",
      stationIds: ["st-02"],
      variants: ["K2"],
      factor4M: "Material",
      symptom: "False alarms on new grey sealer",
      rootCause: "Lower contrast under current lighting",
      countermeasure: "Add polarising filter; re-validate model as a 4M change",
      standardRevised: "Inspection standard, camera set-up",
      validatedByRole: "role:senior_expert@body",
      validatedAt: "2027-01-12T09:00:00.000+07:00",
    },
    {
      id: "KC-SEAL-030",
      revision: 1,
      status: "draft",
      process: "Sealer",
      stationIds: ["st-04"],
      variants: ["K2"],
      factor4M: "Man",
      symptom: "Offset bead after operator rotation",
      rootCause: "Hand-over misses robot path check",
      countermeasure: "Pending senior validation",
      standardRevised: "—",
    },
    {
      id: "KC-SEAL-004",
      revision: 4,
      status: "retired",
      process: "Sealer",
      stationIds: ["st-04"],
      variants: ["K2"],
      factor4M: "Machine",
      symptom: "Excess sealer",
      rootCause: "Old pump regulator (replaced)",
      countermeasure: "Superseded by KC-SEAL-014",
      standardRevised: "—",
    },
  ];

  const additionalValidated = Array.from({ length: 6 }, (_, index): KnowledgeCard => ({
    id: `KC-SEAL-${String(40 + index).padStart(3, "0")}`,
    revision: 1,
    status: "validated",
    process: "Sealer",
    stationIds: [`st-0${(index % 6) + 1}`],
    variants: ["K2"],
    factor4M: (["Man", "Machine", "Material", "Method"] as const)[index % 4],
    symptom: `Validated sealer symptom ${index + 1}`,
    rootCause: `Validated root cause ${index + 1}`,
    countermeasure: `Validated countermeasure ${index + 1}`,
    standardRevised: `Sealer standard section ${index + 1}`,
    validatedByRole: "role:senior_expert@body",
    validatedAt: new Date(SEED_NOW - (20 + index) * DAY_MS).toISOString(),
  }));

  return [
    ...examples,
    ...additionalValidated,
    {
      id: "KC-SEAL-050",
      revision: 1,
      status: "draft",
      process: "Sealer",
      stationIds: ["st-06"],
      variants: ["K2"],
      factor4M: "Method",
      symptom: "Draft observation",
      rootCause: "Under investigation",
      countermeasure: "Pending senior validation",
      standardRevised: "—",
    },
  ];
}

function createIdeas(): Idea[] {
  return Array.from({ length: 40 }, (_, index) => {
    const implemented = index < 11;
    const answered = index < 31;
    const createdAt = new Date(SEED_NOW - (40 - index) * DAY_MS).toISOString();
    return {
      id: `idea-${String(index + 1).padStart(3, "0")}`,
      stationId: stations[index % 6].id,
      text: `Simulated improvement idea ${index + 1}`,
      status: implemented ? "implemented" : answered ? "answered" : "submitted",
      createdAt,
      answeredAt: answered ? new Date(Date.parse(createdAt) + 5 * DAY_MS).toISOString() : undefined,
    };
  });
}

export function createSeedData(): StoreSnapshot {
  return {
    currentShift: {
      id: "shift-a-2027-03-14",
      label: "A",
      startsAt: "2027-03-14T07:00:00.000+07:00",
      endsAt: "2027-03-14T15:30:00.000+07:00",
    },
    stations,
    defectTypes,
    alerts: [...createHistoricalAlerts(), ...currentAlerts],
    decisions: currentDecisions,
    tickets: createTickets(),
    cards: createCards(),
    ideas: createIdeas(),
    modelReviews: [
      {
        id: "review-st02-current",
        stationId: "st-02",
        alertIds: currentAlerts.slice(0, 3).map((alert) => alert.id),
        status: "pending",
        eligibleForModelUpdate: false,
      },
    ],
  };
}
