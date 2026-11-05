"use server";

import { isValidId, nextEntityId, nextSimulatedTimestamp, revalidatePaths } from "@/lib/action-support";
import { proposeCorrectionIfNeeded } from "@/lib/corrections/propose";
import { getCurrentRole } from "@/lib/queries";
import { openRepeatTicketIfNeeded } from "@/lib/repeat-ticket";
import { AUTONOMY_RULE, getAutonomyState, isWithinWindow, netPressureStep } from "@/lib/rules/autonomy";
import { getStore } from "@/lib/store";
import type { ActionResult, Alert, CorrectionTypeId } from "@/lib/types";

const TEAM_LEADER = "role:team_leader@body" as const;
const DAY_MS = 86_400_000;

function refresh() {
  revalidatePaths(["/", "/shift-board", "/station", "/events", "/simulator", "/kaizen"]);
}

async function teamLeaderOnly(): Promise<ActionResult | null> {
  return (await getCurrentRole()) === "team_leader"
    ? null
    : { ok: false, error: "Only the team leader decides on a correction." };
}

/** One tap: the robot's own routine would run it. The app records the decision only. */
export async function approveCorrection(correctionId: string): Promise<ActionResult> {
  try {
    if (!isValidId(correctionId)) return { ok: false, error: "Invalid correction ID." };
    const denied = await teamLeaderOnly();
    if (denied) return denied;
    return await getStore().mutate<ActionResult>((draft) => {
      const correction = draft.corrections.find((c) => c.id === correctionId);
      if (!correction) return { ok: false, error: "Correction not found." };
      if (correction.status !== "proposed") return { ok: false, error: "This correction has already been decided." };
      const at = nextSimulatedTimestamp(draft);
      // The window is checked again at approval: other steps may have run since the proposal.
      if (correction.correctionType && !isWithinWindow(correction.correctionType, netPressureStep(draft.corrections, correction.stationId, draft.currentShift), correction.stepPercent ?? 0)) {
        correction.mode = "engineer";
        correction.status = "escalated";
        correction.escalationReason = "outside_window";
        return { ok: false, error: "This step is now outside the window, so it went to the engineer." };
      }
      correction.status = "approved";
      correction.decidedBy = TEAM_LEADER;
      correction.decidedAt = at;
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not approve the correction." };
  } finally {
    refresh();
  }
}

export async function rejectCorrection(correctionId: string): Promise<ActionResult> {
  try {
    if (!isValidId(correctionId)) return { ok: false, error: "Invalid correction ID." };
    const denied = await teamLeaderOnly();
    if (denied) return denied;
    return await getStore().mutate<ActionResult>((draft) => {
      const correction = draft.corrections.find((c) => c.id === correctionId);
      if (!correction) return { ok: false, error: "Correction not found." };
      if (correction.status !== "proposed") return { ok: false, error: "This correction has already been decided." };
      correction.status = "rejected";
      correction.decidedBy = TEAM_LEADER;
      correction.decidedAt = nextSimulatedTimestamp(draft);
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not reject the correction." };
  } finally {
    refresh();
  }
}

/** Undo an approved or auto-executed correction. A reversal counts against earned autonomy. */
export async function reverseCorrection(correctionId: string): Promise<ActionResult> {
  try {
    if (!isValidId(correctionId)) return { ok: false, error: "Invalid correction ID." };
    const denied = await teamLeaderOnly();
    if (denied) return denied;
    return await getStore().mutate<ActionResult>((draft) => {
      const correction = draft.corrections.find((c) => c.id === correctionId);
      if (!correction) return { ok: false, error: "Correction not found." };
      if (correction.status !== "approved" && correction.status !== "auto_executed") {
        return { ok: false, error: "Only an approved or auto-executed correction can be reversed." };
      }
      correction.status = "reversed";
      correction.reversedBy = TEAM_LEADER;
      correction.reversedAt = nextSimulatedTimestamp(draft);
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not reverse the correction." };
  } finally {
    refresh();
  }
}

/** One tap, logged. Off returns this correction type to "propose"; on is allowed only while the rule is met. */
export async function setAutonomy(stationId: string, correctionType: CorrectionTypeId, state: "off" | "on"): Promise<ActionResult> {
  try {
    if (!isValidId(stationId) || (correctionType !== "nozzle_purge" && correctionType !== "pressure_step") || (state !== "off" && state !== "on")) {
      return { ok: false, error: "Invalid autonomy switch." };
    }
    const denied = await teamLeaderOnly();
    if (denied) return denied;
    return await getStore().mutate<ActionResult>((draft) => {
      const autonomy = getAutonomyState(draft.corrections, draft.autonomySwitches, stationId, correctionType);
      if (state === "off" && autonomy.level !== "auto") return { ok: false, error: "Auto within window is already off." };
      if (state === "on" && !autonomy.unlocked) {
        return { ok: false, error: `Auto needs ${AUTONOMY_RULE.minApprovals} approvals and no reversal first.` };
      }
      if (state === "on" && !autonomy.switchedOff) return { ok: false, error: "Auto within window is already on." };
      draft.autonomySwitches.push({
        id: nextEntityId("autonomy", draft.autonomySwitches.map((s) => s.id)),
        stationId,
        correctionType,
        state,
        actor: TEAM_LEADER,
        createdAt: nextSimulatedTimestamp(draft),
      });
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not switch autonomy." };
  } finally {
    refresh();
  }
}

/**
 * Demo control: adds simulated past team-leader approvals of "sealer pressure step" at
 * st-04 (one per earlier day) until one approval short of the rule, and a fresh proposal
 * if none is waiting, so the next approval on the shift board unlocks auto.
 */
export async function fastForwardApprovals(): Promise<ActionResult> {
  try {
    return await getStore().mutate<ActionResult>((draft) => {
      const stationId = "st-04";
      const type: CorrectionTypeId = "pressure_step";
      const autonomy = getAutonomyState(draft.corrections, draft.autonomySwitches, stationId, type);
      if (autonomy.reversals > AUTONOMY_RULE.maxReversals) {
        return { ok: false, error: "A reversal is logged for this correction, so auto stays locked. Reset the demo to try again." };
      }
      const shiftStart = Date.parse(draft.currentShift.startsAt);
      const missing = Math.max(0, AUTONOMY_RULE.minApprovals - 1 - autonomy.approvals);
      const existing = draft.corrections.filter((c) => c.fastForward).length;
      for (let n = 0; n < missing; n += 1) {
        const day = existing + n + 1;
        const createdAt = new Date(shiftStart - day * DAY_MS + 3 * 3_600_000).toISOString();
        const step = n % 2 === 0 ? -2 : 2;
        draft.corrections.push({
          id: nextEntityId("correction", draft.corrections.map((c) => c.id)),
          stationId,
          correctionType: type,
          defectTypeId: step < 0 ? "BEAD_EXCESS" : "BEAD_THIN",
          alertId: null,
          stepPercent: step,
          mode: "propose",
          status: "approved",
          createdAt,
          decidedBy: TEAM_LEADER,
          decidedAt: new Date(Date.parse(createdAt) + 60_000).toISOString(),
          fastForward: true,
        });
      }
      const waiting = draft.corrections.some((c) => c.stationId === stationId && c.correctionType === type && c.status === "proposed");
      if (!waiting && getAutonomyState(draft.corrections, draft.autonomySwitches, stationId, type).approvals < AUTONOMY_RULE.minApprovals) {
        draft.corrections.push({
          id: nextEntityId("correction", draft.corrections.map((c) => c.id)),
          stationId,
          correctionType: type,
          defectTypeId: "BEAD_THIN",
          alertId: null,
          stepPercent: 2,
          mode: "propose",
          status: "proposed",
          createdAt: nextSimulatedTimestamp(draft),
          fastForward: true,
        });
      }
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not fast-forward the approvals." };
  } finally {
    refresh();
  }
}

/**
 * Demo control: the operator at st-04 confirms thin beads until this one repeats (at
 * least two this shift), so the correction rule runs: propose, auto within window, or engineer.
 */
export async function injectCorrectionRepeat(): Promise<ActionResult> {
  try {
    return await getStore().mutate<ActionResult>((draft) => {
      const confirmedThin = () =>
        draft.alerts.filter(
          (a) => a.stationId === "st-04" && a.defectTypeId === "BEAD_THIN" && a.status === "confirmed" && Date.parse(a.createdAt) >= Date.parse(draft.currentShift.startsAt),
        ).length;
      const target = Math.max(confirmedThin() + 1, 2);
      while (confirmedThin() < target) {
        const n = draft.alerts.filter((a) => a.id.startsWith("alert-sim-correction-")).length + 1;
        const createdAt = nextSimulatedTimestamp(draft);
        const alert: Alert = {
          id: `alert-sim-correction-${n}`,
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
        openRepeatTicketIfNeeded(draft, alert);
        proposeCorrectionIfNeeded(draft, alert);
      }
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not add the repeat." };
  } finally {
    refresh();
  }
}
