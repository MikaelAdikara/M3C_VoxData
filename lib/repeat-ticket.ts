import { nextSimulatedTimestamp } from "@/lib/action-support";
import { getRobotTicketTrigger, getWalkCheckTicketTrigger, PARETO_RULE, signalKey, type SignalTicketTrigger } from "@/lib/rules/signals";
import { getRepeatTicketTrigger, nextKaizenTicketId } from "@/lib/rules/tickets";
import { showStandardStepsIfNeeded } from "@/lib/standard-steps/show";
import { equipmentById, isWalkCheckSymptom, signalLabel, signalSubject } from "@/lib/signals/catalog";
import type { Alert, LineSignal, StoreSnapshot, Ticket, WorkOrder } from "@/lib/types";

/** Robot error code and walk-check tickets are owned by maintenance. */
export const MAINTENANCE_OWNER = "role:maintenance@body" as const;

export function openRepeatTicketIfNeeded(
  draft: StoreSnapshot,
  alert: Alert,
): Ticket | null {
  if (!alert.defectTypeId) return null;
  const trigger = getRepeatTicketTrigger(draft, alert.stationId, alert.defectTypeId);
  if (!trigger) return null;

  const defectType = draft.defectTypes.find((item) => item.id === alert.defectTypeId);
  const triggerAlerts = trigger.triggerAlertIds
    .map((id) => draft.alerts.find((item) => item.id === id))
    .filter((item): item is Alert => item !== undefined);
  const ticket: Ticket = {
    id: nextKaizenTicketId(draft.tickets),
    stationId: alert.stationId,
    defectTypeId: alert.defectTypeId,
    triggerAlertIds: trigger.triggerAlertIds,
    ownerRole: "role:engineer@body",
    status: "open",
    a3: {
      background: `Three confirmed ${defectType?.name ?? alert.defectTypeId} alerts at ${alert.stationId} in shift ${draft.currentShift.label}.`,
      currentCondition: triggerAlerts
        .map((item) => `${item.bodyId} at ${item.roi}`)
        .join("; "),
      rootCause: "",
      countermeasure: "",
      check: "",
      standardise: "",
    },
    aiPrefilledFields: ["background", "currentCondition"],
    createdAt: nextSimulatedTimestamp(draft),
  };
  draft.tickets.push(ticket);
  return ticket;
}

/** A confirmed defect that an open ticket already covers is logged on that ticket. Returns the ticket updated. */
export function logRepeatOnOpenTicket(draft: StoreSnapshot, alert: Alert): Ticket | null {
  if (!alert.defectTypeId) return null;
  const ticket = draft.tickets.find(
    (t) => t.stationId === alert.stationId && t.defectTypeId === alert.defectTypeId && t.status !== "closed" && (t.source ?? "bead") === "bead",
  );
  if (!ticket || ticket.triggerAlertIds.includes(alert.id) || ticket.repeatAlertIds?.includes(alert.id)) return null;
  ticket.repeatAlertIds = [...(ticket.repeatAlertIds ?? []), alert.id];
  return ticket;
}

/**
 * Everything a confirmed bead defect sets off. The Kaizen ticket is opened or updated first and
 * whatever the standard step does later; a step never hides a repeat from the Kaizen loop.
 */
export function handleConfirmedBeadAlert(draft: StoreSnapshot, alert: Alert) {
  const opened = openRepeatTicketIfNeeded(draft, alert);
  const updated = opened ? null : logRepeatOnOpenTicket(draft, alert);
  const steps = showStandardStepsIfNeeded(draft, alert);
  return { opened, updated, steps };
}

function signalTicket(draft: StoreSnapshot, signal: LineSignal, trigger: SignalTicketTrigger, background: string): Ticket {
  const signals = trigger.triggerSignalIds
    .map((id) => draft.signals.find((item) => item.id === id))
    .filter((item): item is LineSignal => item !== undefined);
  const ticket: Ticket = {
    id: nextKaizenTicketId(draft.tickets),
    stationId: signal.stationId,
    defectTypeId: null,
    triggerAlertIds: [],
    source: signal.source,
    triggerSignalIds: trigger.triggerSignalIds,
    signalKey: trigger.signalKey,
    ...(trigger.closedWorkOrder ? { returnedAfterWorkOrderId: trigger.closedWorkOrder.id } : {}),
    subject: signalSubject(signal),
    ownerRole: MAINTENANCE_OWNER,
    status: "open",
    a3: {
      background,
      currentCondition: signals.map((item) => `${dayTime(item.createdAt)} ${signalLabel(item)}`).join("; "),
      rootCause: "",
      countermeasure: "",
      check: "",
      standardise: "",
    },
    aiPrefilledFields: ["background", "currentCondition"],
    createdAt: nextSimulatedTimestamp(draft),
  };
  draft.tickets.push(ticket);
  return ticket;
}

/** Robot error code: a ticket opens when the code rises in the weekly Pareto. */
export function openRobotTicketIfNeeded(draft: StoreSnapshot, signal: LineSignal): Ticket | null {
  const trigger = getRobotTicketTrigger(draft, signal);
  if (!trigger?.week) return null;
  const { week } = trigger;
  const equipment = equipmentById(signal.equipmentId)?.name ?? signal.equipmentId;
  return signalTicket(
    draft,
    signal,
    trigger,
    `${signalLabel(signal)} on ${equipment} at ${signal.stationId} rose in the weekly Pareto: ${week.thisWeek} this week against a trailing ${PARETO_RULE.trailingWeeks}-week average of ${formatAverage(week.trailingAverage)} a week (rule: at least ${PARETO_RULE.minThisWeek} and at least ${PARETO_RULE.multiple}× the average), before any breakdown.`,
  );
}

/**
 * Walk-check finding: attach it to the open work order for the same finding, or open one.
 * When the finding comes back after its work order closed, a new work order and a Kaizen ticket open.
 */
export function routeWalkCheck(draft: StoreSnapshot, signal: LineSignal): { workOrder: WorkOrder; ticket: Ticket | null } {
  if (signal.source !== "walk_check" || !isWalkCheckSymptom(signal.code)) throw new Error("Not a walk-check finding.");
  const key = signalKey(signal);
  const open = draft.workOrders.find((order) => order.status === "open" && `walk_check:${order.equipmentId}:${order.symptom}` === key);
  if (open) {
    open.findingIds.push(signal.id);
    return { workOrder: open, ticket: null };
  }
  const trigger = getWalkCheckTicketTrigger(draft, signal);
  const workOrder: WorkOrder = {
    id: nextWorkOrderId(draft.workOrders),
    stationId: signal.stationId,
    equipmentId: signal.equipmentId,
    symptom: signal.code,
    findingIds: [signal.id],
    status: "open",
    openedAt: signal.createdAt,
    ...(trigger?.closedWorkOrder ? { returnOf: trigger.closedWorkOrder.id } : {}),
  };
  draft.workOrders.push(workOrder);
  if (!trigger?.closedWorkOrder) return { workOrder, ticket: null };
  const equipment = equipmentById(signal.equipmentId)?.name ?? signal.equipmentId;
  const ticket = signalTicket(
    draft,
    signal,
    trigger,
    `${signalLabel(signal)} on ${equipment} at ${signal.stationId} came back after work order ${trigger.closedWorkOrder.id} was closed. The fix did not hold; new work order ${workOrder.id}.`,
  );
  return { workOrder, ticket };
}

export function nextWorkOrderId(orders: readonly WorkOrder[]): string {
  const highest = orders.reduce((max, order) => {
    const match = /^WO-(\d+)$/.exec(order.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 4100);
  return `WO-${highest + 1}`;
}

const formatAverage = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const dayTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));
