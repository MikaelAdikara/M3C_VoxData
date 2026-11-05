"use server";

import {
  isValidId,
  nextEntityId,
  nextSimulatedTimestamp,
  normalizeOptionalText,
  revalidatePaths,
} from "@/lib/action-support";
import { getCurrentRole } from "@/lib/queries";
import { MAINTENANCE_OWNER, openRobotTicketIfNeeded, routeWalkCheck } from "@/lib/repeat-ticket";
import { equipmentById, isWalkCheckSymptom, ROBOT_CODES } from "@/lib/signals/catalog";
import { getStore } from "@/lib/store";
import type { ActionResult, Actor, LineSignal, WalkCheckSymptom } from "@/lib/types";

const MAX_WALK_NOTE = 120;
const DEMO_ROBOT = "st-04/robot-1";
const DEMO_ROBOT_CODE = "E-2210";

function refresh() {
  revalidatePaths(["/signals", "/kaizen", "/events", "/metrics", "/simulator"]);
}

/**
 * A member's tablet walk-check finding. Operators and team leaders log them. The finding
 * opens a work order (or joins the open one); back after its work order closed, it opens a ticket.
 */
export async function submitWalkCheck(input: {
  equipmentId: string;
  symptom: string;
  photoAttached?: boolean;
  note?: string;
}): Promise<ActionResult> {
  try {
    const equipment = typeof input?.equipmentId === "string" ? equipmentById(input.equipmentId) : undefined;
    if (!equipment) return { ok: false, error: "Choose the equipment you checked." };
    if (!isWalkCheckSymptom(input.symptom)) return { ok: false, error: "Choose what you found." };
    const note = normalizeOptionalText(input.note, MAX_WALK_NOTE);
    if (note === null) return { ok: false, error: `Note must be ${MAX_WALK_NOTE} characters or fewer.` };
    const role = await getCurrentRole();
    if (role !== "operator" && role !== "team_leader") {
      return { ok: false, error: "Walk-checks are logged by line members: operator or team leader." };
    }

    return await getStore().mutate<ActionResult>((draft) => {
      const signal: LineSignal = {
        id: nextEntityId("signal", draft.signals.map((item) => item.id)),
        source: "walk_check",
        stationId: equipment.stationId,
        equipmentId: equipment.id,
        code: input.symptom as WalkCheckSymptom,
        photoAttached: Boolean(input.photoAttached),
        ...(note ? { note } : {}),
        actor: `role:${role}@${role === "operator" ? equipment.stationId : "body"}` as Actor,
        createdAt: nextSimulatedTimestamp(draft),
      };
      draft.signals.push(signal);
      routeWalkCheck(draft, signal);
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not log the walk-check." };
  } finally {
    refresh();
  }
}

/**
 * Demo: maintenance closes a work order in its own system; the app mirrors the closure
 * (simulated). If the same finding is logged again afterwards, a Kaizen ticket opens.
 */
export async function closeWorkOrder(workOrderId: string): Promise<ActionResult> {
  try {
    if (!isValidId(workOrderId)) return { ok: false, error: "Invalid work order ID." };
    return await getStore().mutate<ActionResult>((draft) => {
      const order = draft.workOrders.find((item) => item.id === workOrderId);
      if (!order) return { ok: false, error: "Work order not found." };
      if (order.status === "closed") return { ok: false, error: "This work order is already closed." };
      order.status = "closed";
      order.closedAt = nextSimulatedTimestamp(draft);
      order.closedBy = MAINTENANCE_OWNER;
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not close the work order." };
  } finally {
    refresh();
  }
}

/**
 * Demo: the robot controller at st-04 reports a minor error code (simulated), as it would
 * through the plant's existing error-code feed. A ticket opens once the code rises in the
 * weekly Pareto, not on a count within one shift.
 */
export async function injectRobotErrors(count: number): Promise<ActionResult> {
  try {
    if (!Number.isSafeInteger(count) || count < 1 || count > 3) return { ok: false, error: "Invalid count." };
    if (!ROBOT_CODES.some((item) => item.code === DEMO_ROBOT_CODE)) return { ok: false, error: "Unknown code." };
    return await getStore().mutate<ActionResult>((draft) => {
      const start = Date.parse(nextSimulatedTimestamp(draft));
      const shiftEnd = Date.parse(draft.currentShift.endsAt);
      for (let n = 0; n < count; n += 1) {
        // A few minutes apart, as a controller would report a recurring minor error.
        const createdAt = new Date(Math.min(start + n * 6 * 60_000, shiftEnd)).toISOString();
        const signal: LineSignal = {
          id: nextEntityId("signal", draft.signals.map((item) => item.id)),
          source: "robot_error",
          stationId: "st-04",
          equipmentId: DEMO_ROBOT,
          code: DEMO_ROBOT_CODE,
          actor: `controller:${DEMO_ROBOT}`,
          createdAt,
        };
        draft.signals.push(signal);
        openRobotTicketIfNeeded(draft, signal);
      }
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not add the robot error codes." };
  } finally {
    refresh();
  }
}
