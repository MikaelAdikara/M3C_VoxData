import type { Alert, Decision, DefectTypeId, Shift } from "@/lib/types";

export const REPEAT_TICKET_THRESHOLD = 3;

function isWithinShift(createdAt: string, shift: Shift): boolean {
  const timestamp = Date.parse(createdAt);
  return timestamp >= Date.parse(shift.startsAt) && timestamp <= Date.parse(shift.endsAt);
}

export function isConfirmedAlert(alert: Alert, decisions: readonly Decision[]): boolean {
  return (
    alert.status === "confirmed" ||
    decisions.some((decision) => decision.alertId === alert.id && decision.kind === "confirm")
  );
}

export interface RepeatState {
  count: number;
  alertIds: string[];
  isThirdRepeat: boolean;
  thresholdReached: boolean;
}

export function getConfirmedRepeatState(
  alerts: readonly Alert[],
  decisions: readonly Decision[],
  stationId: string,
  defectTypeId: DefectTypeId,
  shift: Shift,
): RepeatState {
  const matching = alerts
    .filter(
      (alert) =>
        alert.stationId === stationId &&
        alert.defectTypeId === defectTypeId &&
        isWithinShift(alert.createdAt, shift) &&
        isConfirmedAlert(alert, decisions),
    )
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  return {
    count: matching.length,
    alertIds: matching.map((alert) => alert.id),
    isThirdRepeat: matching.length === REPEAT_TICKET_THRESHOLD,
    thresholdReached: matching.length >= REPEAT_TICKET_THRESHOLD,
  };
}
