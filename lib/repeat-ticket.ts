import { nextSimulatedTimestamp } from "@/lib/action-support";
import { getSignalTicketTrigger } from "@/lib/rules/signals";
import { getRepeatTicketTrigger, nextKaizenTicketId } from "@/lib/rules/tickets";
import { equipmentById, signalLabel, signalSubject } from "@/lib/signals/catalog";
import type { Alert, LineSignal, StoreSnapshot, Ticket } from "@/lib/types";

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

/** Same repeat rule for a robot error code or a walk-check finding; the ticket lands in the same list. */
export function openSignalTicketIfNeeded(draft: StoreSnapshot, signal: LineSignal): Ticket | null {
  const trigger = getSignalTicketTrigger(draft, signal);
  if (!trigger) return null;
  const signals = trigger.triggerSignalIds
    .map((id) => draft.signals.find((item) => item.id === id))
    .filter((item): item is LineSignal => item !== undefined);
  const subject = signalSubject(signal);
  const what = signal.source === "robot_error" ? "controller reports" : "walk-check findings";
  const ticket: Ticket = {
    id: nextKaizenTicketId(draft.tickets),
    stationId: signal.stationId,
    defectTypeId: null,
    triggerAlertIds: [],
    source: signal.source,
    triggerSignalIds: trigger.triggerSignalIds,
    signalKey: trigger.signalKey,
    subject,
    ownerRole: "role:engineer@body",
    status: "open",
    a3: {
      background: `Three ${what} of ${signalLabel(signal).toLowerCase()} on ${equipmentById(signal.equipmentId)?.name ?? signal.equipmentId} at ${signal.stationId} in shift ${draft.currentShift.label}${signal.source === "robot_error" ? ", before any breakdown" : ""}.`,
      currentCondition: signals.map((item) => `${hhmm(item.createdAt)} ${signalLabel(item)}`).join("; "),
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

const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));
