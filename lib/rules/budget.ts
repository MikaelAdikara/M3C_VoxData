import type { Alert, Decision, Shift } from "@/lib/types";

export const FALSE_ALARM_BUDGET = 2;

function isWithinShift(createdAt: string, shift: Shift): boolean {
  const timestamp = Date.parse(createdAt);
  return timestamp >= Date.parse(shift.startsAt) && timestamp <= Date.parse(shift.endsAt);
}

function isRejectedAlert(alert: Alert, decisions: readonly Decision[]): boolean {
  return (
    alert.status === "rejected" ||
    decisions.some((decision) => decision.alertId === alert.id && decision.kind === "reject")
  );
}

export interface FalseAlarmBudgetState {
  count: number;
  budget: number;
  remaining: number;
  exceeded: boolean;
  rejectedAlertIds: string[];
}

export function getFalseAlarmBudgetState(
  alerts: readonly Alert[],
  decisions: readonly Decision[],
  stationId: string,
  shift: Shift,
): FalseAlarmBudgetState {
  const rejectedAlertIds = alerts
    .filter(
      (alert) =>
        alert.stationId === stationId &&
        isWithinShift(alert.createdAt, shift) &&
        isRejectedAlert(alert, decisions),
    )
    .map((alert) => alert.id);

  return {
    count: rejectedAlertIds.length,
    budget: FALSE_ALARM_BUDGET,
    remaining: Math.max(0, FALSE_ALARM_BUDGET - rejectedAlertIds.length),
    exceeded: rejectedAlertIds.length > FALSE_ALARM_BUDGET,
    rejectedAlertIds,
  };
}
