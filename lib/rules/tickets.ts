import { getConfirmedRepeatState, REPEAT_TICKET_THRESHOLD } from "@/lib/rules/repeat";
import type { DefectTypeId, StoreSnapshot, Ticket } from "@/lib/types";

export interface RepeatTicketTrigger {
  stationId: string;
  defectTypeId: DefectTypeId;
  triggerAlertIds: string[];
}

export function getRepeatTicketTrigger(
  snapshot: StoreSnapshot,
  stationId: string,
  defectTypeId: DefectTypeId,
): RepeatTicketTrigger | null {
  const repeat = getConfirmedRepeatState(
    snapshot.alerts,
    snapshot.decisions,
    stationId,
    defectTypeId,
    snapshot.currentShift,
  );
  if (!repeat.thresholdReached) return null;

  const triggerAlertIds = repeat.alertIds.slice(0, REPEAT_TICKET_THRESHOLD);
  const sameTriggerAlreadyHandled = snapshot.tickets.some(
    (ticket) =>
      ticket.stationId === stationId &&
      ticket.defectTypeId === defectTypeId &&
      triggerAlertIds.every((alertId) => ticket.triggerAlertIds.includes(alertId)),
  );
  const activeTicketExists = snapshot.tickets.some(
    (ticket) =>
      ticket.stationId === stationId &&
      ticket.defectTypeId === defectTypeId &&
      ticket.status !== "closed",
  );
  if (sameTriggerAlreadyHandled || activeTicketExists) return null;

  return { stationId, defectTypeId, triggerAlertIds };
}

export function nextKaizenTicketId(tickets: readonly Ticket[]): string {
  const highest = tickets.reduce((max, ticket) => {
    const match = /^KZ-SEAL-(\d+)$/.exec(ticket.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `KZ-SEAL-${String(highest + 1).padStart(3, "0")}`;
}
