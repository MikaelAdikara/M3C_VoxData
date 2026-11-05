import { nextEntityId, nextSimulatedTimestamp } from "@/lib/action-support";
import { getConfirmedRepeatState, isWithinShift } from "@/lib/rules/repeat";
import { ASK_ENGINEER_DEFECTS, ASK_ENGINEER_STEP, cardedStepFor } from "@/lib/standard-steps/catalog";
import type { Alert, StandardStep, StoreSnapshot } from "@/lib/types";

/** A step is shown from the second confirmed occurrence of the same bead defect at a station in a shift. */
export const STEP_REPEAT_THRESHOLD = 2;

/**
 * After an operator confirms a bead defect that repeats: show the step the station's revised
 * standard holds for it (only while its card is validated), and a pressure change only as
 * "ask the engineer". Records what was shown; the team leader's tap is recorded separately.
 * This never touches the Kaizen ticket: the repeat is logged there whatever the step does.
 */
export function showStandardStepsIfNeeded(draft: StoreSnapshot, alert: Alert): StandardStep[] {
  const defectTypeId = alert.defectTypeId;
  if (!defectTypeId) return [];
  const repeat = getConfirmedRepeatState(draft.alerts, draft.decisions, alert.stationId, defectTypeId, draft.currentShift);
  if (repeat.count < STEP_REPEAT_THRESHOLD) return [];
  if (draft.standardSteps.some((step) => step.alertId === alert.id)) return [];

  const ticketId =
    draft.tickets.find((t) => t.stationId === alert.stationId && t.defectTypeId === defectTypeId && t.status !== "closed")?.id ?? null;
  const shown: StandardStep[] = [];
  const push = (step: Omit<StandardStep, "id" | "createdAt" | "alertId" | "stationId" | "defectTypeId" | "ticketId" | "status">) => {
    const record: StandardStep = {
      id: nextEntityId("step", draft.standardSteps.map((s) => s.id)),
      stationId: alert.stationId,
      defectTypeId,
      alertId: alert.id,
      ticketId,
      status: "shown",
      createdAt: nextSimulatedTimestamp(draft),
      ...step,
    };
    draft.standardSteps.push(record);
    shown.push(record);
  };

  const carded = cardedStepFor(alert.stationId, defectTypeId);
  const card = carded && draft.cards.find((c) => c.id === carded.cardId && c.status === "validated");
  const cardedWaiting = draft.standardSteps.some(
    (s) => s.inStandard && s.stationId === alert.stationId && s.defectTypeId === defectTypeId && s.status === "shown",
  );
  if (carded && card && !cardedWaiting) {
    push({ stepType: carded.stepType, inStandard: true, sourceCardId: card.id });
  }

  const askedThisShift = draft.standardSteps.some(
    (s) => !s.inStandard && s.stationId === alert.stationId && s.defectTypeId === defectTypeId && isWithinShift(s.createdAt, draft.currentShift),
  );
  if (ASK_ENGINEER_DEFECTS.includes(defectTypeId) && !askedThisShift) {
    push({ stepType: ASK_ENGINEER_STEP.stepType, inStandard: false, sourceCardId: null });
  }
  return shown;
}
