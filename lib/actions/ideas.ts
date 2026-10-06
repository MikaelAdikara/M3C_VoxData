"use server";

import {
  isValidId,
  nextEntityId,
  nextSimulatedTimestamp,
  normalizeRequiredText,
  revalidatePaths,
} from "@/lib/action-support";
import { getCurrentRole } from "@/lib/queries";
import { getStore } from "@/lib/store";
import type { ActionResult } from "@/lib/types";

const MAX_IDEA_LENGTH = 280;

export async function submitIdea(stationId: string, text: string): Promise<ActionResult> {
  try {
    if (!isValidId(stationId)) return { ok: false, error: "Invalid station ID." };
    const normalizedText = normalizeRequiredText(text, MAX_IDEA_LENGTH);
    if (!normalizedText) {
      return { ok: false, error: `Idea must be between 1 and ${MAX_IDEA_LENGTH} characters.` };
    }
    if ((await getCurrentRole()) !== "operator") {
      return { ok: false, error: "Only the operator can submit a station idea." };
    }

    return await getStore().mutate<ActionResult>((draft) => {
      if (!draft.stations.some((station) => station.id === stationId)) {
        return { ok: false, error: "Station not found." };
      }
      draft.ideas.push({
        id: nextEntityId("idea", draft.ideas.map((item) => item.id)),
        stationId,
        text: normalizedText,
        status: "submitted",
        createdAt: nextSimulatedTimestamp(draft),
      });
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not submit the idea." };
  } finally {
    revalidatePaths(["/station"]);
  }
}
