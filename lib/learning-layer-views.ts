import { isWithinShift } from "@/lib/rules/repeat";
import { PARETO_RULE, PARETO_RULE_TEXT, robotPareto, WALK_CHECK_RULE_TEXT, workOrderKey } from "@/lib/rules/signals";
import {
  EQUIPMENT,
  equipmentById,
  ROBOT_CODES,
  signalLabel,
  WALK_CHECK_SYMPTOMS,
  type Equipment,
} from "@/lib/signals/catalog";
import { ASK_ENGINEER_STEP, CARDED_STEPS, cardedStepFor, NOT_DONE_REASONS, stepLabel } from "@/lib/standard-steps/catalog";
import type {
  LineSignal,
  Shift,
  SignalView,
  StandardStep,
  StepNotDoneReason,
  StoreSnapshot,
  WalkCheckSymptom,
  WorkOrder,
} from "@/lib/types";

export function toSignalView(signal: LineSignal): SignalView {
  return {
    id: signal.id,
    source: signal.source,
    stationId: signal.stationId,
    equipmentId: signal.equipmentId,
    equipmentName: equipmentById(signal.equipmentId)?.name ?? signal.equipmentId,
    code: signal.code,
    label: signalLabel(signal),
    photoAttached: Boolean(signal.photoAttached),
    actor: signal.actor,
    createdAt: signal.createdAt,
  };
}

export interface RobotParetoRow {
  key: string;
  stationId: string;
  equipmentName: string;
  code: string;
  label: string;
  thisWeek: number;
  trailingAverage: number;
  needed: number;
  rising: boolean;
  ticketId: string | null;
}

export interface WorkOrderView {
  id: string;
  stationId: string;
  equipmentName: string;
  symptomLabel: string;
  findings: number;
  status: WorkOrder["status"];
  openedAt: string;
  closedAt: string | null;
  returnOf: string | null;
  ticketId: string | null;
}

export interface SignalsView {
  shift: Shift;
  pareto: { rule: string; minThisWeek: number; multiple: number; trailingWeeks: number; rows: RobotParetoRow[] };
  workOrders: { rule: string; open: WorkOrderView[]; closed: WorkOrderView[] };
  recent: SignalView[];
  equipment: Equipment[];
  symptoms: { value: WalkCheckSymptom; label: string }[];
  provenance: "simulated";
  sourceLabel: string;
}

/** /signals: robot error codes (weekly Pareto rule) and member walk-checks (work-order return rule). */
export function buildSignalsView(snapshot: StoreSnapshot): SignalsView {
  const openTicket = (key: string) => snapshot.tickets.find((t) => t.signalKey === key && t.status !== "closed")?.id ?? null;
  const rows = robotPareto(snapshot).map((week): RobotParetoRow => {
    const equipment = equipmentById(week.equipmentId);
    return {
      key: week.key,
      stationId: equipment?.stationId ?? week.equipmentId.split("/")[0],
      equipmentName: equipment?.name ?? week.equipmentId,
      code: week.code,
      label: ROBOT_CODES.find((c) => c.code === week.code)?.label ?? week.code,
      thisWeek: week.thisWeek,
      trailingAverage: week.trailingAverage,
      needed: week.needed,
      rising: week.rising,
      ticketId: openTicket(week.key),
    };
  });

  const toOrder = (order: WorkOrder): WorkOrderView => ({
    id: order.id,
    stationId: order.stationId,
    equipmentName: equipmentById(order.equipmentId)?.name ?? order.equipmentId,
    symptomLabel: signalLabel({ source: "walk_check", code: order.symptom }),
    findings: order.findingIds.length,
    status: order.status,
    openedAt: order.openedAt,
    closedAt: order.closedAt ?? null,
    returnOf: order.returnOf ?? null,
    ticketId: order.returnOf ? openTicket(workOrderKey(order)) : null,
  });
  const newestFirst = (a: WorkOrder, b: WorkOrder) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt);

  return {
    shift: snapshot.currentShift,
    pareto: { rule: PARETO_RULE_TEXT, ...PARETO_RULE, rows },
    workOrders: {
      rule: WALK_CHECK_RULE_TEXT,
      open: snapshot.workOrders.filter((o) => o.status === "open").sort(newestFirst).map(toOrder),
      closed: snapshot.workOrders.filter((o) => o.status === "closed").sort(newestFirst).slice(0, 4).map(toOrder),
    },
    recent: [...snapshot.signals].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10).map(toSignalView),
    equipment: EQUIPMENT,
    symptoms: WALK_CHECK_SYMPTOMS,
    provenance: "simulated",
    sourceLabel: "Simulated controller codes, walk-check findings and work orders",
  };
}

export interface StandardStepItemView {
  id: string;
  stationId: string;
  label: string;
  instruction: string;
  inStandard: boolean;
  sourceCardId: string | null;
  cardRevision: number | null;
  defectName: string;
  bodyId: string | null;
  ticketId: string | null;
  status: StandardStep["status"];
  notDoneReason: string | null;
  createdAt: string;
  recordedAt: string | null;
}

export interface StandardStepsView {
  waiting: StandardStepItemView[];
  askEngineer: StandardStepItemView[];
  recent: StandardStepItemView[];
  catalog: { label: string; stationId: string; defects: string; cardId: string; cardValidated: boolean }[];
  notDoneReasons: { value: StepNotDoneReason; label: string }[];
  provenance: "simulated";
  sourceLabel: string;
}

/** Shift board: standard steps from validated cards, the team leader's taps, and "ask the engineer". */
export function buildStandardStepsView(snapshot: StoreSnapshot): StandardStepsView {
  const defectNames = new Map(snapshot.defectTypes.map((d) => [d.id, d.name]));
  const alerts = new Map(snapshot.alerts.map((a) => [a.id, a]));
  const cards = new Map(snapshot.cards.map((c) => [c.id, c]));
  const reasonLabel = new Map(NOT_DONE_REASONS.map((r) => [r.value, r.label]));
  const toItem = (step: StandardStep): StandardStepItemView => ({
    id: step.id,
    stationId: step.stationId,
    label: stepLabel(step),
    instruction: step.inStandard
      ? (cardedStepFor(step.stationId, step.defectTypeId)?.instruction ?? "")
      : ASK_ENGINEER_STEP.instruction,
    inStandard: step.inStandard,
    sourceCardId: step.sourceCardId,
    cardRevision: step.sourceCardId ? (cards.get(step.sourceCardId)?.revision ?? null) : null,
    defectName: defectNames.get(step.defectTypeId) ?? step.defectTypeId,
    bodyId: alerts.get(step.alertId)?.bodyId ?? null,
    ticketId: step.ticketId,
    status: step.status,
    notDoneReason: step.notDoneReason ? (reasonLabel.get(step.notDoneReason) ?? step.notDoneReason) : null,
    createdAt: step.createdAt,
    recordedAt: step.recordedAt ?? null,
  });
  const shift = snapshot.currentShift;
  const newest = (a: StandardStep, b: StandardStep) => (b.recordedAt ?? b.createdAt).localeCompare(a.recordedAt ?? a.createdAt);
  return {
    waiting: snapshot.standardSteps.filter((s) => s.inStandard && s.status === "shown").sort(newest).map(toItem),
    askEngineer: snapshot.standardSteps.filter((s) => !s.inStandard && isWithinShift(s.createdAt, shift)).sort(newest).map(toItem),
    recent: snapshot.standardSteps.filter((s) => s.inStandard && s.status !== "shown").sort(newest).slice(0, 6).map(toItem),
    catalog: CARDED_STEPS.map((step) => ({
      label: step.label,
      stationId: step.stationId,
      defects: step.defectTypeIds.map((id) => defectNames.get(id) ?? id).join(", ").toLowerCase(),
      cardId: step.cardId,
      cardValidated: cards.get(step.cardId)?.status === "validated",
    })),
    notDoneReasons: NOT_DONE_REASONS,
    provenance: "simulated",
    sourceLabel: "Simulated standard steps from validated cards",
  };
}
