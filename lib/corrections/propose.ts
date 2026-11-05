import { nextEntityId, nextSimulatedTimestamp } from "@/lib/action-support";
import { planCorrection } from "@/lib/rules/autonomy";
import { getConfirmedRepeatState, isWithinShift } from "@/lib/rules/repeat";
import type { Alert, Correction, StoreSnapshot } from "@/lib/types";

/** A correction is proposed from the second confirmed repeat of a bead defect in a shift. */
export const CORRECTION_REPEAT_THRESHOLD = 2;

/**
 * After an operator confirms a bead defect: if it repeats, plan a correction from the
 * station's standardized work and record it as proposed (team leader decides), auto
 * executed (earned, within the window) or escalated to the engineer. Records only.
 */
export function proposeCorrectionIfNeeded(draft: StoreSnapshot, alert: Alert): Correction | null {
  if (!alert.defectTypeId) return null;
  const repeat = getConfirmedRepeatState(draft.alerts, draft.decisions, alert.stationId, alert.defectTypeId, draft.currentShift);
  if (repeat.count < CORRECTION_REPEAT_THRESHOLD) return null;
  if (draft.corrections.some((c) => c.alertId === alert.id)) return null;

  const plan = planCorrection({
    stationId: alert.stationId,
    defectTypeId: alert.defectTypeId,
    corrections: draft.corrections,
    switches: draft.autonomySwitches,
    shift: draft.currentShift,
  });
  const waiting = draft.corrections.some(
    (c) =>
      c.stationId === alert.stationId &&
      ((c.status === "proposed" && c.correctionType === plan.correctionType) ||
        (c.status === "escalated" && c.defectTypeId === alert.defectTypeId && isWithinShift(c.createdAt, draft.currentShift))),
  );
  if (waiting) return null;

  const createdAt = nextSimulatedTimestamp(draft);
  const correction: Correction = {
    id: nextEntityId("correction", draft.corrections.map((c) => c.id)),
    stationId: alert.stationId,
    correctionType: plan.correctionType,
    defectTypeId: alert.defectTypeId,
    alertId: alert.id,
    ...(plan.stepPercent !== undefined ? { stepPercent: plan.stepPercent } : {}),
    mode: plan.mode,
    status: plan.mode === "auto" ? "auto_executed" : plan.mode === "engineer" ? "escalated" : "proposed",
    ...(plan.escalationReason ? { escalationReason: plan.escalationReason } : {}),
    createdAt,
  };
  draft.corrections.push(correction);
  return correction;
}
