"use server";

import { isValidId, nextEntityId, nextSimulatedTimestamp, revalidatePaths } from "@/lib/action-support";
import { getCurrentRole } from "@/lib/queries";
import { handleConfirmedBeadAlert } from "@/lib/repeat-ticket";
import { isNotDoneReason } from "@/lib/standard-steps/catalog";
import { getStore } from "@/lib/store";
import type { ActionResult, Alert } from "@/lib/types";

const TEAM_LEADER = "role:team_leader@body" as const;

function refresh() {
  revalidatePaths(["/", "/shift-board", "/station", "/events", "/simulator", "/kaizen", "/signals"]);
}

/**
 * The team leader runs the step on the robot panel, then taps here. The app records the
 * tap only; it never writes to line control.
 */
export async function markStepDone(stepId: string): Promise<ActionResult> {
  return recordStep(stepId, "done");
}

export async function markStepNotDone(stepId: string, reason: string): Promise<ActionResult> {
  if (!isNotDoneReason(reason)) return { ok: false, error: "Choose why the step was not done." };
  return recordStep(stepId, "not_done", reason);
}

async function recordStep(stepId: string, status: "done" | "not_done", reason?: string): Promise<ActionResult> {
  try {
    if (!isValidId(stepId)) return { ok: false, error: "Invalid step ID." };
    if ((await getCurrentRole()) !== "team_leader") {
      return { ok: false, error: "Only the team leader records a standard step." };
    }
    return await getStore().mutate<ActionResult>((draft) => {
      const step = draft.standardSteps.find((s) => s.id === stepId);
      if (!step) return { ok: false, error: "Step not found." };
      if (!step.inStandard) return { ok: false, error: "This step is not in the standard. Ask the engineer." };
      if (step.status !== "shown") return { ok: false, error: "This step is already recorded." };
      step.status = status;
      if (status === "not_done" && isNotDoneReason(reason)) step.notDoneReason = reason;
      step.recordedBy = TEAM_LEADER;
      step.recordedAt = nextSimulatedTimestamp(draft);
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not record the step." };
  } finally {
    refresh();
  }
}

/**
 * Demo control: the operator at st-04 confirms thin beads until this defect repeats in the
 * shift (at least two), so the standard step shows and the repeat reaches the Kaizen ticket.
 */
export async function injectStepRepeat(): Promise<ActionResult> {
  try {
    return await getStore().mutate<ActionResult>((draft) => {
      const confirmedThin = () =>
        draft.alerts.filter(
          (a) => a.stationId === "st-04" && a.defectTypeId === "BEAD_THIN" && a.status === "confirmed" && Date.parse(a.createdAt) >= Date.parse(draft.currentShift.startsAt),
        ).length;
      const target = Math.max(confirmedThin() + 1, 2);
      while (confirmedThin() < target) {
        const n = draft.alerts.filter((a) => a.id.startsWith("alert-sim-step-")).length + 1;
        const createdAt = nextSimulatedTimestamp(draft);
        const alert: Alert = {
          id: `alert-sim-step-${n}`,
          stationId: "st-04",
          bodyId: `K2-27-0315${String(n).padStart(2, "0")}`,
          roi: "seam-L-door-05",
          defectTypeId: "BEAD_THIN",
          anomalyScore: 0.71,
          threshold: 0.61,
          modelVersion: "sealer-st04-v1.3",
          image: "",
          mask: "",
          visualScenarioId: "bead-thin-simulation",
          createdAt,
          status: "confirmed",
        };
        draft.alerts.push(alert);
        draft.decisions.push({
          id: nextEntityId("decision", draft.decisions.map((d) => d.id)),
          alertId: alert.id,
          actor: "role:operator@st-04",
          kind: "confirm",
          createdAt,
        });
        handleConfirmedBeadAlert(draft, alert);
      }
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not add the repeat." };
  } finally {
    refresh();
  }
}
