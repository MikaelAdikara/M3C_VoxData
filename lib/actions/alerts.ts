"use server";

import {
  isValidId,
  MAX_NOTE_LENGTH,
  nextEntityId,
  nextSimulatedTimestamp,
  normalizeOptionalText,
  revalidatePaths,
} from "@/lib/action-support";
import { getCurrentRole } from "@/lib/queries";
import { getFalseAlarmBudgetState } from "@/lib/rules/budget";
import { getRepeatTicketTrigger, nextKaizenTicketId } from "@/lib/rules/tickets";
import { getStore } from "@/lib/store";
import type { ActionResult, Actor, ReasonCode } from "@/lib/types";

const reasonCodes = new Set<ReasonCode>([
  "reflection",
  "variant_mismatch",
  "dirty_lens",
  "within_tolerance",
  "other",
]);

export async function confirmAlert(alertId: string): Promise<ActionResult> {
  try {
    if (!isValidId(alertId)) return { ok: false, error: "Invalid alert ID." };
    if ((await getCurrentRole()) !== "operator") {
      return { ok: false, error: "Only the operator can confirm an alert." };
    }

    return await getStore().mutate<ActionResult>((draft) => {
      const alert = draft.alerts.find((item) => item.id === alertId);
      if (!alert) return { ok: false, error: "Alert not found." };
      if (alert.status !== "open") return { ok: false, error: "Alert has already been decided." };
      if (!alert.defectTypeId) return { ok: false, error: "Alert has no defect type." };

      alert.status = "confirmed";
      draft.decisions.push({
        id: nextEntityId("decision", draft.decisions.map((item) => item.id)),
        alertId: alert.id,
        actor: `role:operator@${alert.stationId}` as Actor,
        kind: "confirm",
        createdAt: nextSimulatedTimestamp(draft),
      });

      const trigger = getRepeatTicketTrigger(draft, alert.stationId, alert.defectTypeId);
      if (trigger) {
        const defectType = draft.defectTypes.find((item) => item.id === alert.defectTypeId);
        const triggerAlerts = trigger.triggerAlertIds
          .map((id) => draft.alerts.find((item) => item.id === id))
          .filter((item) => item !== undefined);
        draft.tickets.push({
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
        });
      }
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not confirm the alert." };
  } finally {
    revalidatePaths(["/station", "/shift-board", "/kaizen"]);
  }
}

export async function rejectAlert(
  alertId: string,
  reasonCode: ReasonCode,
  note?: string,
): Promise<ActionResult> {
  try {
    if (!isValidId(alertId)) return { ok: false, error: "Invalid alert ID." };
    if (!reasonCodes.has(reasonCode)) return { ok: false, error: "Invalid rejection reason." };
    const normalizedNote = normalizeOptionalText(note, MAX_NOTE_LENGTH);
    if (normalizedNote === null) {
      return { ok: false, error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer.` };
    }
    if ((await getCurrentRole()) !== "operator") {
      return { ok: false, error: "Only the operator can reject an alert." };
    }

    return await getStore().mutate<ActionResult>((draft) => {
      const alert = draft.alerts.find((item) => item.id === alertId);
      if (!alert) return { ok: false, error: "Alert not found." };
      if (alert.status !== "open") return { ok: false, error: "Alert has already been decided." };

      alert.status = "rejected";
      draft.decisions.push({
        id: nextEntityId("decision", draft.decisions.map((item) => item.id)),
        alertId: alert.id,
        actor: `role:operator@${alert.stationId}` as Actor,
        kind: "reject",
        reasonCode,
        note: normalizedNote,
        createdAt: nextSimulatedTimestamp(draft),
      });

      const budget = getFalseAlarmBudgetState(
        draft.alerts,
        draft.decisions,
        alert.stationId,
        draft.currentShift,
      );
      const review = draft.modelReviews.find(
        (item) => item.stationId === alert.stationId && item.status === "pending",
      );
      if (review) {
        review.alertIds = Array.from(new Set([...review.alertIds, alert.id]));
      } else {
        draft.modelReviews.push({
          id: nextEntityId("review", draft.modelReviews.map((item) => item.id)),
          stationId: alert.stationId,
          alertIds: budget.exceeded ? budget.rejectedAlertIds : [alert.id],
          status: "pending",
          eligibleForModelUpdate: false,
        });
      }
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not reject the alert." };
  } finally {
    revalidatePaths(["/station", "/shift-board"]);
  }
}
