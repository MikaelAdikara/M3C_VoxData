import type { Alert, Decision, DefectTypeId, Shift } from "@/lib/types";

export const REPEAT_TICKET_THRESHOLD = 3;

export function isWithinShift(createdAt: string, shift: Shift): boolean {
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

/**
 * The bead repeat rule: matching items in this shift, oldest first. The third one
 * (REPEAT_TICKET_THRESHOLD) opens a Kaizen ticket. Robot codes and walk-check findings
 * have their own rules (lib/rules/signals.ts).
 */
export function repeatStateOf(items: readonly { id: string; createdAt: string }[], shift: Shift): RepeatState {
  const matching = items
    .filter((item) => isWithinShift(item.createdAt, shift))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  return {
    count: matching.length,
    alertIds: matching.map((item) => item.id),
    isThirdRepeat: matching.length === REPEAT_TICKET_THRESHOLD,
    thresholdReached: matching.length >= REPEAT_TICKET_THRESHOLD,
  };
}

export function getConfirmedRepeatState(
  alerts: readonly Alert[],
  decisions: readonly Decision[],
  stationId: string,
  defectTypeId: DefectTypeId,
  shift: Shift,
): RepeatState {
  return repeatStateOf(
    alerts.filter(
      (alert) =>
        alert.stationId === stationId &&
        alert.defectTypeId === defectTypeId &&
        isConfirmedAlert(alert, decisions),
    ),
    shift,
  );
}
