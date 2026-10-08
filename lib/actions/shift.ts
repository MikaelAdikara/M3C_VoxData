"use server";

import {
  isValidId,
  MAX_NOTE_LENGTH,
  nextEntityId,
  nextSimulatedTimestamp,
  normalizeRequiredText,
  revalidatePaths,
} from "@/lib/action-support";
import { getCurrentRole } from "@/lib/queries";
import { getStore } from "@/lib/store";
import type { ActionResult, ShiftDecision } from "@/lib/types";

const shiftDecisions = new Set<ShiftDecision>(["stop_fix", "contain", "continue"]);

export async function decideShift(
  alertId: string,
  decision: ShiftDecision,
  note: string,
): Promise<ActionResult> {
  try {
    if (!isValidId(alertId)) return { ok: false, error: "Invalid alert ID." };
    if (!shiftDecisions.has(decision)) return { ok: false, error: "Invalid shift decision." };
    const normalizedNote = normalizeRequiredText(note, MAX_NOTE_LENGTH);
    if (!normalizedNote || /[\r\n]/.test(normalizedNote)) {
      return { ok: false, error: "A one-line team leader note is required." };
    }
    if ((await getCurrentRole()) !== "team_leader") {
      return { ok: false, error: "Only the team leader can make the shift decision." };
    }

    return await getStore().mutate<ActionResult>((draft) => {
      const alert = draft.alerts.find((item) => item.id === alertId);
      if (!alert) return { ok: false, error: "Alert not found." };
      if (alert.status !== "confirmed") {
        return { ok: false, error: "The operator must confirm the alert first." };
      }
      if (
        draft.decisions.some(
          (item) => item.alertId === alert.id && shiftDecisions.has(item.kind as ShiftDecision),
        )
      ) {
        return { ok: false, error: "A team leader decision already exists." };
      }

      if (decision === "stop_fix" && draft.lineOperation.state === "stopped") {
        return { ok: false, error: "The line is already stopped. Complete the repair before another stop." };
      }

      const loggedDecision = {
        id: nextEntityId("decision", draft.decisions.map((item) => item.id)),
        alertId: alert.id,
        actor: "role:team_leader@body" as const,
        kind: decision,
        note: normalizedNote,
        createdAt: nextSimulatedTimestamp(draft),
      };
      draft.decisions.push(loggedDecision);
      if (decision === "stop_fix") {
        draft.lineOperation.state = "stopped";
        draft.lineOperation.stoppedByDecisionId = loggedDecision.id;
        draft.lineOperation.heldBodyId = alert.bodyId;
        draft.lineOperation.stoppedAt = loggedDecision.createdAt;
        draft.lineOperation.restartedAt = undefined;
        draft.lineOperation.restartNote = undefined;
        draft.lineOperation.restartedByRole = undefined;
      }
      alert.status = "closed";
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not save the shift decision." };
  } finally {
    revalidatePaths(["/", "/station", "/shift-board", "/cameras", "/metrics"]);
  }
}

export async function restartLine(repairNote: string): Promise<ActionResult> {
  try {
    const note = normalizeRequiredText(repairNote, MAX_NOTE_LENGTH);
    if (!note || /[\r\n]/.test(note)) {
      return { ok: false, error: "A one-line repair completion note is required." };
    }
    if ((await getCurrentRole()) !== "team_leader") {
      return { ok: false, error: "Only the team leader can restart the line." };
    }
    return await getStore().mutate<ActionResult>((draft) => {
      if (draft.lineOperation.state !== "stopped" || !draft.lineOperation.stoppedByDecisionId) {
        return { ok: false, error: "The line is not stopped for repair." };
      }
      draft.lineOperation.state = "running";
      draft.lineOperation.restartedAt = nextSimulatedTimestamp(draft);
      draft.lineOperation.restartNote = note;
      draft.lineOperation.restartedByRole = "role:team_leader@body";
      draft.lineOperation.heldBodyId = undefined;
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not restart the line." };
  } finally {
    revalidatePaths(["/", "/shift-board", "/station", "/cameras"]);
  }
}

export async function verifyRejection(reviewId: string): Promise<ActionResult> {
  try {
    if (!isValidId(reviewId)) return { ok: false, error: "Invalid review ID." };
    if ((await getCurrentRole()) !== "team_leader") {
      return { ok: false, error: "Only the team leader can verify a rejection." };
    }

    return await getStore().mutate<ActionResult>((draft) => {
      const review = draft.modelReviews.find((item) => item.id === reviewId);
      if (!review) return { ok: false, error: "Rejection review not found." };
      if (review.status !== "pending") {
        return { ok: false, error: "Rejection review has already been verified." };
      }
      if (review.alertIds.length === 0) {
        return { ok: false, error: "Rejection review has no alerts to verify." };
      }
      const allRejected = review.alertIds.every((alertId) => {
        const alert = draft.alerts.find((item) => item.id === alertId);
        return (
          alert?.stationId === review.stationId &&
          alert.status === "rejected" &&
          draft.decisions.some((item) => item.alertId === alertId && item.kind === "reject" && item.actor === `role:operator@${review.stationId}`)
        );
      });
      if (!allRejected) {
        return { ok: false, error: "Review contains an alert without a rejection decision." };
      }

      review.status = "verified";
      review.verifiedByRole = "role:team_leader@body";
      review.verifiedAt = nextSimulatedTimestamp(draft);
      review.eligibleForModelUpdate = true;
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not verify the rejection." };
  } finally {
    revalidatePaths(["/shift-board", "/cameras", "/metrics"]);
  }
}
