import { nextSimulatedTimestamp } from "@/lib/action-support";
import { getRepeatTicketTrigger, nextKaizenTicketId } from "@/lib/rules/tickets";
import type { Alert, StoreSnapshot, Ticket } from "@/lib/types";

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
