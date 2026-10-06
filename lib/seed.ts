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
  const alertsInDay = day === 29 ? 76 : 80;
  const rejectionRate = 0.31 - (day * 0.07) / 29;
  const rejectedPerDay = Math.round(alertsInDay * rejectionRate);
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
  const alerts = Array.from({ length: 2_396 }, (_, index) => historyAlert(index));
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

function matchingTriggerAlerts(
  alerts: readonly Alert[],
  stationId: string,
  defectTypeId: DefectTypeId,
  placement: "first" | "last" = "first",
): Alert[] {
  const matching = alerts
    .filter(
      (alert) =>
        alert.stationId === stationId &&
        alert.defectTypeId === defectTypeId &&
        alert.status === "confirmed",
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const selected = placement === "last" ? matching.slice(-3) : matching.slice(0, 3);
  if (selected.length !== 3) {
    throw new Error(`Seed needs three confirmed ${defectTypeId} alerts at ${stationId}.`);
  }
  return selected;
}

function createTickets(alerts: readonly Alert[]): Ticket[] {
  const closedSpecs: { stationId: string; defectTypeId: DefectTypeId; cycleDays: number }[] = [
    { stationId: "st-04", defectTypeId: "BEAD_THIN", cycleDays: 16 },
    { stationId: "st-04", defectTypeId: "BEAD_BREAK", cycleDays: 18 },
    { stationId: "st-01", defectTypeId: "BEAD_OFFSET", cycleDays: 19 },
    { stationId: "st-02", defectTypeId: "BEAD_EXCESS", cycleDays: 19 },
    { stationId: "st-05", defectTypeId: "BEAD_MISSING", cycleDays: 21 },
    { stationId: "st-06", defectTypeId: "BEAD_THIN", cycleDays: 22 },
  ];
  const closedTickets = closedSpecs.map((spec, index): Ticket => {
    const triggerAlerts = matchingTriggerAlerts(alerts, spec.stationId, spec.defectTypeId);
    return {
      id: `KZ-SEAL-${String(index + 1).padStart(3, "0")}`,
      stationId: spec.stationId,
      defectTypeId: spec.defectTypeId,
      triggerAlertIds: triggerAlerts.map((alert) => alert.id),
      ownerRole: "role:engineer@body",
      status: "closed",
      a3: emptyA3,
      aiPrefilledFields: [],
      createdAt: triggerAlerts.at(-1)!.createdAt,
      closedAt: new Date(Date.parse(triggerAlerts[0].createdAt) + spec.cycleDays * DAY_MS).toISOString(),
    };
  });
  const thinTriggers = matchingTriggerAlerts(alerts, "st-04", "BEAD_THIN", "last");
  const offsetTriggers = matchingTriggerAlerts(alerts, "st-02", "BEAD_OFFSET", "last");

  return [
    ...closedTickets,
    {
      id: "KZ-SEAL-007",
      stationId: "st-04",
      defectTypeId: "BEAD_THIN",
      triggerAlertIds: thinTriggers.map((alert) => alert.id),
      ownerRole: "role:engineer@body",
      status: "a3_in_progress",
      a3: { ...emptyA3, background: "Three thin-bead alerts at st-04 in shift A." },
      aiPrefilledFields: ["background"],
      createdAt: thinTriggers.at(-1)!.createdAt,
    },
    {
      id: "KZ-SEAL-008",
      stationId: "st-02",
      defectTypeId: "BEAD_OFFSET",
      triggerAlertIds: offsetTriggers.map((alert) => alert.id),
      ownerRole: "role:engineer@body",
      status: "countermeasure_trial",
      a3: emptyA3,
      aiPrefilledFields: [],
      createdAt: offsetTriggers.at(-1)!.createdAt,
    },
  ];
}

function createCards(tickets: readonly Ticket[]): KnowledgeCard[] {
  const closedTicket = (id: string) => {
    const ticket = tickets.find((item) => item.id === id);
    if (!ticket?.closedAt) throw new Error(`Seed card needs closed ticket ${id}.`);
    return ticket;
  };
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
      validatedAt: closedTicket("KZ-SEAL-001").closedAt,
      sourceTicketId: "KZ-SEAL-001",
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
      validatedAt: closedTicket("KZ-SEAL-002").closedAt,
      sourceTicketId: "KZ-SEAL-002",
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
      standardRevised: "Pending validation",
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
      standardRevised: "Retired; replacement standard is recorded in KC-SEAL-014",
    },
  ];

  const additionalValidated: KnowledgeCard[] = [
    {
      id: "KC-SEAL-040",
      revision: 1,
      status: "validated",
      process: "Sealer",
      stationIds: ["st-01"],
      variants: ["K2"],
      factor4M: "Method",
      symptom: "Bead offset after a robot path program change",
      rootCause: "First-off path verification was skipped after recipe selection",
      countermeasure: "Verify the robot path on the first-off body before normal production",
      standardRevised: "Robot path change checklist, first-off verification",
      validatedByRole: "role:senior_expert@body",
      validatedAt: closedTicket("KZ-SEAL-003").closedAt,
      sourceTicketId: "KZ-SEAL-003",
    },
    {
      id: "KC-SEAL-041",
      revision: 1,
      status: "validated",
      process: "Sealer",
      stationIds: ["st-02"],
      variants: ["K2"],
      factor4M: "Machine",
      symptom: "Excess sealer at the end of the bead",
      rootCause: "Shut-off response slowed after applicator valve seal wear",
      countermeasure: "Inspect valve response and confirm clean cut-off on a trial body",
      standardRevised: "Applicator inspection standard, valve response check",
      validatedByRole: "role:senior_expert@body",
      validatedAt: closedTicket("KZ-SEAL-004").closedAt,
      sourceTicketId: "KZ-SEAL-004",
    },
    {
      id: "KC-SEAL-042",
      revision: 1,
      status: "validated",
      process: "Sealer",
      stationIds: ["st-05"],
      variants: ["K2"],
      factor4M: "Material",
      symptom: "Missing bead immediately after a material cartridge change",
      rootCause: "An air pocket remained in the supply line after changeover",
      countermeasure: "Purge until flow is continuous and verify the first bead before release",
      standardRevised: "Material change standard, purge and first-bead check",
      validatedByRole: "role:senior_expert@body",
      validatedAt: closedTicket("KZ-SEAL-005").closedAt,
      sourceTicketId: "KZ-SEAL-005",
    },
    {
      id: "KC-SEAL-043",
      revision: 1,
      status: "validated",
      process: "Sealer",
      stationIds: ["st-06"],
      variants: ["K2"],
      factor4M: "Machine",
      symptom: "Thin bead during rapid pressure fluctuation",
      rootCause: "Pressure regulator response lagged during demand change",
      countermeasure: "Check regulator response and hold pressure within the approved start-up range",
      standardRevised: "Sealer pressure verification standard",
      validatedByRole: "role:senior_expert@body",
      validatedAt: closedTicket("KZ-SEAL-006").closedAt,
      sourceTicketId: "KZ-SEAL-006",
    },
    {
      id: "KC-SEAL-044",
      revision: 1,
      status: "validated",
      process: "Sealer",
      stationIds: ["st-03"],
      variants: ["K2"],
      factor4M: "Man",
      symptom: "Bead break after manual robot recovery",
      rootCause: "Recovery resumed from the middle of the seam instead of its defined restart point",
      countermeasure: "Return to the defined seam restart point and inspect the recovered bead",
      standardRevised: "Robot recovery work instruction, seam restart step",
      validatedByRole: "role:senior_expert@body",
      validatedAt: new Date(SEED_NOW - 18 * DAY_MS).toISOString(),
    },
    {
      id: "KC-SEAL-045",
      revision: 1,
      status: "validated",
      process: "Sealer",
      stationIds: ["st-04"],
      variants: ["K2"],
      factor4M: "Method",
      symptom: "Excess bead at a corner transition",
      rootCause: "Robot speed reduction was not paired with a lower flow command",
      countermeasure: "Pair the corner speed profile with the approved flow setpoint",
      standardRevised: "Sealer recipe standard, corner transition settings",
      validatedByRole: "role:senior_expert@body",
      validatedAt: new Date(SEED_NOW - 17 * DAY_MS).toISOString(),
    },
  ];

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
      symptom: "Intermittent bead offset after fixture release",
      rootCause: "Fixture and path relationship is under investigation",
      countermeasure: "Pending senior validation",
      standardRevised: "Pending validation",
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
  const alerts = [...createHistoricalAlerts(), ...currentAlerts];
  const tickets = createTickets(alerts);
  return {
    currentShift: {
      id: "shift-a-2027-03-14",
      label: "A",
      startsAt: "2027-03-14T07:00:00.000+07:00",
      endsAt: "2027-03-14T15:30:00.000+07:00",
    },
    stations,
    defectTypes,
    alerts,
    decisions: currentDecisions,
    tickets,
    cards: createCards(tickets),
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
    routedQuestions: [],
  };
}
