"use server";

import { nextEntityId, revalidatePaths } from "@/lib/action-support";
import { openRepeatTicketIfNeeded } from "@/lib/repeat-ticket";
import { getStore } from "@/lib/store";
import type { ActionResult, Alert } from "@/lib/types";

const TRUE_DEFECT_ID = "alert-st04-open-001";
const FALSE_ALARM_ID = "alert-st02-reflection-demo";
const REPEAT_ALERT_IDS = [
  "alert-sim-repeat-excess-1",
  "alert-sim-repeat-excess-2",
  "alert-sim-repeat-excess-3",
] as const;

function refreshDemoRoutes() {
  revalidatePaths([
    "/station",
    "/shift-board",
    "/kaizen",
    "/knowledge",
    "/metrics",
    "/simulator",
  ]);
}

export async function injectTrueDefect(): Promise<ActionResult> {
  try {
    return await getStore().mutate<ActionResult>((draft) => {
      if (draft.alerts.some((alert) => alert.id === TRUE_DEFECT_ID)) return { ok: true };
      draft.alerts.push({
        id: TRUE_DEFECT_ID,
        stationId: "st-04",
        bodyId: "K2-27-031487",
        roi: "seam-R-door-07",
        defectTypeId: "BEAD_BREAK",
        anomalyScore: 0.83,
        threshold: 0.61,
        modelVersion: "sealer-st04-v1.3",
        image: "/beads/bead_break.svg",
        mask: "/beads/bead_break-mask.svg",
        createdAt: "2027-03-14T08:42:17.412+07:00",
        status: "open",
      });
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not inject the true-defect scenario." };
  } finally {
    refreshDemoRoutes();
  }
}

export async function injectFalseAlarm(): Promise<ActionResult> {
  try {
    return await getStore().mutate<ActionResult>((draft) => {
      if (draft.alerts.some((alert) => alert.id === FALSE_ALARM_ID)) return { ok: true };
      draft.alerts.push({
        id: FALSE_ALARM_ID,
        stationId: "st-02",
        bodyId: "K2-27-031488",
        roi: "seam-L-door-03",
        defectTypeId: "BEAD_THIN",
        anomalyScore: 0.66,
        threshold: 0.61,
        modelVersion: "sealer-st04-v1.3",
        image: "/beads/reflection.svg",
        mask: "/beads/reflection-mask.svg",
        createdAt: "2027-03-14T08:44:00.000+07:00",
        status: "open",
      });
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not inject the false-alarm scenario." };
  } finally {
    refreshDemoRoutes();
  }
}

export async function injectRepeat3(): Promise<ActionResult> {
  try {
    return await getStore().mutate<ActionResult>((draft) => {
      const existing = draft.alerts.filter((alert) =>
        REPEAT_ALERT_IDS.includes(alert.id as (typeof REPEAT_ALERT_IDS)[number]),
      );
      if (existing.length > 0) {
        const ticketExists = draft.tickets.some((ticket) =>
          REPEAT_ALERT_IDS.every((alertId) => ticket.triggerAlertIds.includes(alertId)),
        );
        return existing.length === REPEAT_ALERT_IDS.length && ticketExists
          ? { ok: true }
          : { ok: false, error: "Repeat scenario state is incomplete. Reset the demo." };
      }
      const activeConflict = draft.tickets.some(
        (ticket) =>
          ticket.stationId === "st-04" &&
          ticket.defectTypeId === "BEAD_EXCESS" &&
          ticket.status !== "closed",
      );
      if (activeConflict) {
        return { ok: false, error: "An active repeat ticket already exists for this scenario." };
      }

      REPEAT_ALERT_IDS.forEach((id, index) => {
        const alert: Alert = {
          id,
          stationId: "st-04",
          bodyId: `K2-27-03149${index}`,
          roi: "seam-R-roof-16",
          defectTypeId: "BEAD_EXCESS",
          anomalyScore: Number((0.75 + index * 0.03).toFixed(2)),
          threshold: 0.61,
          modelVersion: "sealer-st04-v1.3",
          image: "/beads/bead_excess.svg",
          mask: "/beads/bead_excess-mask.svg",
          createdAt: `2027-03-14T09:${String(index * 5).padStart(2, "0")}:00.000+07:00`,
          status: "confirmed",
        };
        draft.alerts.push(alert);
        draft.decisions.push({
          id: nextEntityId("decision", draft.decisions.map((decision) => decision.id)),
          alertId: alert.id,
          actor: "role:operator@st-04",
          kind: "confirm",
          createdAt: alert.createdAt,
        });
        openRepeatTicketIfNeeded(draft, alert);
      });
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not inject the repeat scenario." };
  } finally {
    refreshDemoRoutes();
  }
}

export async function resetDemo(): Promise<ActionResult> {
  try {
    await getStore().reset();
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reset the demo." };
  } finally {
    refreshDemoRoutes();
  }
}
