import type {
  Alert,
  Camera,
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
export const SEED_REFERENCE_CLOCK = "2027-03-14T08:45:00.000+07:00";
export const SEED_VERSION = "m3c-gate1-v1";

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

function uptime14d(cameraIndex: number, state: Camera["state"]): number[] {
  return Array.from({ length: 14 }, (_, day) => {
    if (state === "offline" && day === 13) return 0.15;
    if (state === "attention" && [4, 9, 13].includes(day)) return 0.52 + day / 1_000;
    return Number((0.94 + ((cameraIndex * 7 + day * 11) % 57) / 1_000).toFixed(3));
  });
}

export function createSeedCameras(): Camera[] {
  const specs: Pick<Camera, "id" | "stationId" | "name" | "kind" | "state" | "note" | "modelVersion">[] = [
    { id: "sealer-edge-01/cam-01", stationId: "st-01", name: "Sealer 01", kind: "sealer", state: "online", modelVersion: "sealer-st01-v1.3" },
    { id: "sealer-edge-02/cam-01", stationId: "st-02", name: "Sealer 02", kind: "sealer", state: "attention", note: "Reflection on grey sealer; three rejected alerts this shift. Check lens and lighting.", modelVersion: "sealer-st02-v1.3" },
    { id: "body-edge-03/cam-01", stationId: "st-03", name: "Body 03", kind: "sealer", state: "online", modelVersion: "body-st03-v1.1" },
    { id: "sealer-edge-04/cam-01", stationId: "st-04", name: "Sealer 04", kind: "sealer", state: "online", modelVersion: "sealer-st04-v1.3" },
    { id: "body-edge-05/cam-01", stationId: "st-05", name: "Body 05", kind: "sealer", state: "online", modelVersion: "body-st05-v1.1" },
    { id: "body-edge-06/cam-01", stationId: "st-06", name: "Body 06", kind: "sealer", state: "offline", note: "No frames since 06:12; housing power check.", modelVersion: "body-st06-v1.1" },
    { id: "paint-body-map/tablet-01", stationId: "paint-bm", name: "Paint body map", kind: "paint_tablet", state: "online", note: "Tablet findings; no CCTV feed.", modelVersion: "paint-map-v1.0" },
    { id: "final-edge-01/cam-01", stationId: "final-01", name: "Final inspection", kind: "final", state: "online", modelVersion: "final-v1.0" },
  ];
  return specs.map((spec, index) => ({
    ...spec,
    uptime14d: uptime14d(index, spec.state),
    lastLensCleanAt: new Date(SEED_NOW - (spec.state === "attention" ? 6 : spec.state === "offline" ? 9 : (index % 3) + 1) * DAY_MS).toISOString(),
    fps: spec.kind === "paint_tablet" ? 0 : 25,
    resolution: spec.kind === "paint_tablet" ? "not_applicable" : "1920x1080",
  }));
}

export function createSeedRecordingGaps(): StoreSnapshot["recordingGaps"] {
  return [{ id: "gap-body-06-current", cameraId: "body-edge-06/cam-01", startsAt: "2027-03-14T06:12:00.000+07:00", reason: "Camera offline since 06:12; housing power check" }];
}

export function createSeedLineOperation(): StoreSnapshot["lineOperation"] {
  return { state: "running", bodiesCompleted: 68 };
}

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
    image: "",
    mask: "",
    visualScenarioId: defectTypeId === "BEAD_BREAK" ? "bead-break-reference" : defectTypeId === "BEAD_EXCESS" ? "bead-excess-reference" : `${defectTypeId.toLowerCase().replace("_", "-")}-simulation`,
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
    alert.visualScenarioId = weightedDefects[index] === "BEAD_BREAK" ? "bead-break-reference" : weightedDefects[index] === "BEAD_EXCESS" ? "bead-excess-reference" : `${weightedDefects[index].toLowerCase().replace("_", "-")}-simulation`;
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
    image: "",
    mask: "",
    visualScenarioId: "reflection-false-alarm",
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
    image: "",
    mask: "",
    visualScenarioId: "bead-offset-simulation",
    createdAt: new Date(SEED_NOW - 8 * 60_000).toISOString(),
    status: "confirmed",
  },
];

const currentDecisions: Decision[] = [
  ...Array.from({ length: 3 }, (_, index): Decision => ({
    id: `decision-st02-reflection-${index + 1}`,
    alertId: `alert-st02-reflection-${index + 1}`,
    actor: "role:operator@st-02",
    kind: "reject",
    reasonCode: "reflection",
    createdAt: new Date(SEED_NOW - (24 - index) * 60_000).toISOString(),
  })),
  { id: "decision-st05-confirm-001", alertId: "alert-st05-confirmed-001", actor: "role:operator@st-05", kind: "confirm", createdAt: new Date(SEED_NOW - 7 * 60_000).toISOString() },
];

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
      a3: { ...emptyA3 },
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
      a3: { ...emptyA3 },
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
  const alerts = [...createHistoricalAlerts(), ...structuredClone(currentAlerts)];
  const tickets = createTickets(alerts);
  return {
    currentShift: {
      id: "shift-a-2027-03-14",
      label: "A",
      startsAt: "2027-03-14T07:00:00.000+07:00",
      endsAt: "2027-03-14T15:30:00.000+07:00",
    },
    stations: structuredClone(stations),
    defectTypes: structuredClone(defectTypes),
    alerts,
    decisions: structuredClone(currentDecisions),
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
    cameras: createSeedCameras(),
    recordingGaps: createSeedRecordingGaps(),
    cameraMaintenanceTickets: [],
    lineOperation: createSeedLineOperation(),
  };
}
