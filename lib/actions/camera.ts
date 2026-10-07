"use server";

import { isValidId, nextEntityId, nextSimulatedTimestamp, normalizeRequiredText, revalidatePaths } from "@/lib/action-support";
import { getCurrentRole } from "@/lib/queries";
import { getStore } from "@/lib/store";
import type { ActionResult } from "@/lib/types";

export async function createCameraTicket(cameraId: string, reason: string): Promise<ActionResult> {
  try {
    if (!isValidId(cameraId)) return { ok: false, error: "Invalid camera ID." };
    const normalizedReason = normalizeRequiredText(reason, 280);
    if (!normalizedReason || /[\r\n]/.test(normalizedReason)) {
      return { ok: false, error: "A one-line maintenance reason is required (max 280 characters)." };
    }
    const role = await getCurrentRole();
    if (role !== "team_leader" && role !== "engineer") {
      return { ok: false, error: "Only the team leader or DX cell engineer can create a camera ticket." };
    }
    return await getStore().mutate<ActionResult>((draft) => {
      const camera = draft.cameras.find((item) => item.id === cameraId);
      if (!camera) return { ok: false, error: "Camera not found." };
      if (draft.cameraMaintenanceTickets.some((item) => item.cameraId === cameraId && item.status === "open")) {
        return { ok: true };
      }
      draft.cameraMaintenanceTickets.push({
        id: nextEntityId("camera-maintenance", draft.cameraMaintenanceTickets.map((item) => item.id)),
        cameraId,
        reason: normalizedReason,
        status: "open",
        createdAt: nextSimulatedTimestamp(draft),
        createdByRole: role === "team_leader" ? "role:team_leader@body" : "role:engineer@dx-cell",
      });
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not create the camera maintenance ticket." };
  } finally {
    revalidatePaths(["/cameras", "/shift-board", "/station"]);
  }
}
