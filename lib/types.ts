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
}

export interface MetricsView {
  gate1: KpiView[];
  learningCycleDays: number;
  ideas: {
    submitted: number;
    answeredWithin7Days: number;
    implemented: number;
  };
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
}
