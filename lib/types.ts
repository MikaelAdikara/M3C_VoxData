export type Role =
  | "operator"
  | "team_leader"
  | "engineer"
  | "senior_expert"
  | "management";
export type Actor = `role:${Role}@${string}`;
export type Loop = "shift" | "kaizen" | "launch";
export type Criticality = "leak_critical" | "non_critical";
export type AlertStatus = "open" | "confirmed" | "rejected" | "closed";
export type ShiftDecision = "stop_fix" | "contain" | "continue";
export type ReasonCode =
  | "reflection"
  | "variant_mismatch"
  | "dirty_lens"
  | "within_tolerance"
  | "other";
export type TicketStatus =
  | "open"
  | "a3_in_progress"
  | "countermeasure_trial"
  | "validated"
  | "closed";
export type CardStatus = "draft" | "validated" | "retired";
export type DefectTypeId =
  | "BEAD_BREAK"
  | "BEAD_MISSING"
  | "BEAD_THIN"
  | "BEAD_OFFSET"
  | "BEAD_EXCESS";
export type DecisionKind = "confirm" | "reject" | ShiftDecision;
export type IdeaStatus = "submitted" | "answered" | "implemented";
export type ReviewStatus = "pending" | "verified";
export type Factor4M = "Man" | "Machine" | "Material" | "Method";
export type Provenance = "simulated" | "illustration" | "target" | "benchmark" | "case_data";
export type CameraState = "online" | "attention" | "offline";
export type CameraKind = "sealer" | "paint_tablet" | "final";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface Station {
  id: string;
  line: string;
  area: string;
  name: string;
  type: "sealer" | "body" | "paint" | "final_inspection";
}

export interface DefectType {
  id: DefectTypeId;
  name: string;
  criticality: Criticality;
}

export interface Shift {
  id: string;
  label: "A" | "B";
  startsAt: string;
  endsAt: string;
}

export interface Camera {
  id: string;
  stationId: string;
  name: string;
  kind: CameraKind;
  state: CameraState;
  note?: string;
  uptime14d: number[];
  lastLensCleanAt: string;
  modelVersion: string;
  fps: number;
  resolution: string;
}

export interface RecordingGap {
  id: string;
  cameraId: string;
  startsAt: string;
  endsAt?: string;
  reason: string;
}

export interface CameraMaintenanceTicket {
  id: string;
  cameraId: string;
  reason: string;
  status: "open" | "closed";
  createdAt: string;
  createdByRole: Actor;
}

export interface LineOperation {
  state: "running" | "stopped";
  stoppedByDecisionId?: string;
  heldBodyId?: string;
  stoppedAt?: string;
  restartedAt?: string;
  restartNote?: string;
  restartedByRole?: Actor;
  bodiesCompleted: number;
}

export interface Alert {
  id: string;
  stationId: string;
  bodyId: string;
  roi: string;
  defectTypeId: DefectTypeId | null;
  anomalyScore: number;
  threshold: number;
  modelVersion: string;
  image: string;
  mask: string;
  visualScenarioId?: string;
  createdAt: string;
  status: AlertStatus;
}

export interface Decision {
  id: string;
  alertId: string;
  actor: Actor;
  kind: DecisionKind;
  reasonCode?: ReasonCode;
  note?: string;
  createdAt: string;
}

export interface A3 {
  background: string;
  currentCondition: string;
  rootCause: string;
  countermeasure: string;
  check: string;
  standardise: string;
}

export type A3Field = keyof A3;

export interface Ticket {
  id: string;
  stationId: string;
  defectTypeId: DefectTypeId;
  triggerAlertIds: string[];
  ownerRole: Actor;
  status: TicketStatus;
  a3: A3;
  aiPrefilledFields: A3Field[];
  createdAt: string;
  closedAt?: string;
}

export interface KnowledgeCard {
  id: string;
  revision: number;
  status: CardStatus;
  process: string;
  stationIds: string[];
  variants: string[];
  factor4M: Factor4M;
  symptom: string;
  rootCause: string;
  countermeasure: string;
  standardRevised: string;
  validatedByRole?: Actor;
  validatedAt?: string;
  sourceTicketId?: string;
  returnedComment?: string;
  returnedByRole?: Actor;
  returnedAt?: string;
}

export interface Idea {
  id: string;
  stationId: string;
  text: string;
  status: IdeaStatus;
  createdAt: string;
  answeredAt?: string;
}

export interface ModelReview {
  id: string;
  stationId: string;
  alertIds: string[];
  status: ReviewStatus;
  verifiedByRole?: Actor;
  verifiedAt?: string;
  eligibleForModelUpdate: boolean;
}

export interface RoutedQuestion {
  id: string;
  question: string;
  requestedByRole: Actor;
  ownerRole: Actor;
  status: "routed";
  createdAt: string;
}

export interface RecommendationView {
  decision: ShiftDecision;
  text: string;
  suggestedBy: "system";
  confirmedRepeatCount: number;
}

export interface AlertView {
  id: string;
  stationId: string;
  bodyId: string;
  roi: string;
  defectType: DefectType | null;
  anomalyScore: number;
  threshold: number;
  modelVersion: string;
  image: string;
  mask: string;
  visualScenarioId?: string;
  createdAt: string;
  status: AlertStatus;
  recommendation: RecommendationView | null;
}

export interface ReasonCodeOption {
  value: ReasonCode;
  label: string;
}

export interface StationView {
  station: Station;
  openAlert: AlertView | null;
  reasonCodes: ReasonCodeOption[];
  ideasOpen: number;
  decisionHistory: StationDecisionHistoryItem[];
}

export interface DecisionView {
  kind: DecisionKind;
  actor: Actor;
  reasonCode?: ReasonCode;
  note?: string;
  createdAt: string;
}

export interface StationDecisionHistoryItem {
  alert: AlertView;
  operatorDecision: DecisionView;
  teamLeaderDecision: DecisionView | null;
  occurredAt: string;
}

export interface StationTileView {
  station: Station;
  openAlerts: number;
  confirmedCount: number;
  rejectedCount: number;
  falseAlarmBudget: number;
  modelReviewNeeded: boolean;
  overrideRate: number;
}

export interface ShiftBoardView {
  shift: Shift;
  stations: StationTileView[];
  pendingDecisions: AlertView[];
  modelReviews: ModelReviewView[];
}

export interface ModelReviewView {
  id: string;
  stationId: string;
  alertIds: string[];
  status: ReviewStatus;
  verifiedByRole?: Actor;
  verifiedAt?: string;
  eligibleForModelUpdate: boolean;
}

export interface TicketSummary {
  id: string;
  stationId: string;
  defectType: DefectType;
  ownerRole: Actor;
  status: TicketStatus;
  createdAt: string;
}

export interface KaizenView {
  pareto: { defectType: DefectType; count: number }[];
  tickets: TicketSummary[];
}

export interface TicketView {
  ticket: Ticket;
  defectType: DefectType;
  triggerAlerts: AlertView[];
  a3: A3;
  aiPrefilledFields: A3Field[];
  validation: {
    requiredFieldsComplete: boolean;
    draftCardId: string | null;
    canRequest: boolean;
  };
}

export interface CardRevisionView {
  revision: number;
  status: CardStatus;
  validatedByRole?: Actor;
  validatedAt?: string;
  returnedComment?: string;
  returnedByRole?: Actor;
  returnedAt?: string;
}

export interface CardView extends KnowledgeCard {
  revisions: CardRevisionView[];
}

export interface KnowledgeFilters {
  process?: string;
  stationId?: string;
  status?: CardStatus;
}

export interface KnowledgeView {
  cards: CardView[];
  filters: {
    processes: string[];
    stations: Station[];
    statuses: CardStatus[];
    selected: KnowledgeFilters;
  };
}

export interface KpiView {
  id: string;
  label: string;
  value: number | string;
  unit: string;
  baseline: number | string;
  target: number | string;
  sourceLabel: string;
  provenance?: Provenance;
  baselineSourceLabel?: string;
  baselineProvenance?: Provenance;
  targetSourceLabel?: string;
  targetProvenance?: Provenance;
}

export interface MetricsView {
  gate1: KpiView[];
  falseAlarms: {
    station: Station;
    count: number;
    budget: number;
    withinBudget: boolean;
    provenance: "simulated";
    sourceLabel: string;
    budgetProvenance: "target";
    budgetSourceLabel: string;
  }[];
  overrideRate: {
    baselinePercent: number;
    currentPercent: number;
    gate1TargetPercent: number;
    year2030TargetPercent: number;
    periodLabel: string;
    provenance: "simulated";
    sourceLabel: string;
    baselineProvenance: "case_data";
    baselineSourceLabel: string;
    targetProvenance: "target";
    targetSourceLabel: string;
  };
  learningCycleDays: number;
  learningCycle: { days: number; provenance: "simulated"; sourceLabel: string };
  ideas: {
    submitted: number;
    answeredWithin7Days: number;
    implemented: number;
    provenance: "simulated";
    sourceLabel: string;
  };
  dataLabel: "Simulated data";
  provenance: Provenance;
  sourceLabel: string;
  pareto: { defectType: DefectType; count: number; percent: number; provenance: Provenance; sourceLabel: string }[];
  ticketProgress: { status: TicketStatus; count: number; tickets: TicketSummary[]; provenance: "simulated"; sourceLabel: string }[];
  knowledgeProgress: { status: CardStatus; count: number; provenance: "simulated"; sourceLabel: string }[];
  seedVersion: string;
  seedFingerprint: string;
}

export interface CameraEventView {
  cameraId: string;
  at: string;
  kind: "alert" | "confirm" | "reject" | "stop_fix" | "contain" | "continue" | "gap";
  alertId?: string;
  label: string;
  endsAt?: string;
}

export interface CameraView {
  shift: Shift;
  cameras: (Camera & { openAlertIds: string[]; pendingDecisionAlertIds: string[]; modelReviewNeeded: boolean; modelReview: ModelReviewView | null; maintenanceTicketId: string | null; media: PilotScenarioView["media"] | null })[];
  events: CameraEventView[];
  maintenanceTickets: CameraMaintenanceTicket[];
  provenance: "simulated";
  sourceLabel: string;
}

export interface LineStationView extends StationTileView {
  state: "running" | "yellow_andon" | "model_review" | "contained" | "stopped";
  pendingDecision: AlertView | null;
  lastDecision: DecisionView | null;
}

export interface LineView {
  shift: Shift;
  stations: LineStationView[];
  line: LineOperation;
  taktMinutes: number;
  taktProvenance: "benchmark";
  taktSourceLabel: string;
  bodiesTargetApprox: number;
  bodiesTargetProvenance: "benchmark";
  bodiesTargetSourceLabel: string;
  productionProvenance: "simulated";
  productionSourceLabel: string;
  totals: { open: number; confirmed: number; rejected: number; overrideRate: number; provenance: "simulated"; sourceLabel: string };
  flaggedBody: { bodyId: string; detectedAtStationId: string; currentLocationStationId: null; state: "flagged" | "awaiting_team_leader" | "held_for_repair" | "released"; alertId: string } | null;
  pendingDecisions: AlertView[];
  provenance: "simulated";
  sourceLabel: string;
}

export interface TrailStepView {
  kind: "flagged" | "confirmed" | "rejected" | "team_leader_decision" | "a3_open" | "validated_standard";
  at: string;
  actor: Actor | "system";
  label: string;
  refId: string;
}

export interface TrailView {
  alert: AlertView;
  steps: TrailStepView[];
  ticketId: string | null;
  cardId: string | null;
  provenance: "simulated";
  sourceLabel: string;
}

export interface PilotMediaView {
  assetId: string;
  sourceType: "public_reference" | "generated_simulation";
  provenance: Provenance;
  sourceLabel: string;
  externalClass?: string;
}

export interface PilotScenarioView {
  id: string;
  visualClass: DefectTypeId | "NORMAL" | "REFLECTION";
  defectTypeId: DefectTypeId | null;
  expectedHumanStep: string;
  media: PilotMediaView;
}

export interface PilotView {
  dailyOverride: { date: string; percent: number; sevenDayAveragePercent: number; sampleSize: number; provenance: "simulated"; sourceLabel: string }[];
  weeklyOverride: { week: number; percent: number; sampleSize: number; provenance: "simulated"; sourceLabel: string }[];
  baselinePercent: number;
  currentPercent: number;
  gate1TargetPercent: number;
  baselineSourceLabel: string;
  baselineProvenance: "case_data";
  gate1TargetSourceLabel: string;
  gate1TargetProvenance: "target";
  scenarios: PilotScenarioView[];
  visualReferences: { visualClass: DefectTypeId | "NORMAL"; media: PilotMediaView }[];
  externalClasses: { sourceClass: string; mappingStatus: "external_only" | "needs_domain_review" }[];
  provenance: "simulated";
  sourceLabel: string;
}

export interface SimulatorView {
  seedVersion: string;
  seedFingerprint: string;
  currentFingerprint: string;
  isCanonicalReset: boolean;
  referenceClock: string;
  provenance: "simulated";
  sourceLabel: string;
}

export interface OverviewView {
  line: LineView;
  trail: TrailView | null;
  ledger: { id: string; label: string; baseline: number | string; target: number | string; baselineProvenance: Provenance; targetProvenance: Provenance; baselineSourceLabel: string; targetSourceLabel: string }[];
}

export interface AssistantAnswer {
  mode: "live" | "offline" | "no_card";
  text: string;
  citations: { cardId: string; revision: number }[];
}

export interface StoreSnapshot {
  currentShift: Shift;
  stations: Station[];
  defectTypes: DefectType[];
  alerts: Alert[];
  decisions: Decision[];
  tickets: Ticket[];
  cards: KnowledgeCard[];
  ideas: Idea[];
  modelReviews: ModelReview[];
  routedQuestions: RoutedQuestion[];
  cameras: Camera[];
  recordingGaps: RecordingGap[];
  cameraMaintenanceTickets: CameraMaintenanceTicket[];
  lineOperation: LineOperation;
}
