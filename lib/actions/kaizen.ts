"use server";

import {
  isValidId,
  nextSimulatedTimestamp,
  revalidatePaths,
} from "@/lib/action-support";
import { getCurrentRole } from "@/lib/queries";
import { A3_FIELDS, getNextTicketStatus, isA3Complete } from "@/lib/rules/lifecycle";
import { getStore } from "@/lib/store";
import type { A3, A3Field, ActionResult, Factor4M, KnowledgeCard } from "@/lib/types";

const MAX_A3_FIELD_LENGTH = 2_000;

function normalizeA3Patch(patch: Partial<A3>): Partial<A3> | null {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return null;
  const entries = Object.entries(patch);
  if (entries.length === 0) return null;
  const allowed = new Set<string>(A3_FIELDS);
  if (entries.some(([field, value]) => !allowed.has(field) || typeof value !== "string")) return null;
  if (entries.some(([, value]) => (value as string).trim().length > MAX_A3_FIELD_LENGTH)) return null;
  return Object.fromEntries(entries.map(([field, value]) => [field, (value as string).trim()]));
}

function nextKnowledgeCardId(cards: readonly KnowledgeCard[]): string {
  const highest = cards.reduce((max, card) => {
    const match = /^KC-SEAL-(\d+)$/.exec(card.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `KC-SEAL-${String(highest + 1).padStart(3, "0")}`;
}

function draftFactor(): Factor4M {
  return "Method";
}

export async function updateA3(ticketId: string, patch: Partial<A3>): Promise<ActionResult> {
  try {
    if (!isValidId(ticketId)) return { ok: false, error: "Invalid ticket ID." };
    const normalized = normalizeA3Patch(patch);
    if (!normalized) return { ok: false, error: "Invalid A3 update." };
    if ((await getCurrentRole()) !== "engineer") {
      return { ok: false, error: "Only the owner engineer can update the A3." };
    }

    return await getStore().mutate<ActionResult>((draft) => {
      const ticket = draft.tickets.find((item) => item.id === ticketId);
      if (!ticket) return { ok: false, error: "Kaizen ticket not found." };
      if (!["open", "a3_in_progress", "countermeasure_trial"].includes(ticket.status)) {
        return { ok: false, error: "This ticket no longer accepts A3 updates." };
      }
      for (const [field, value] of Object.entries(normalized) as [A3Field, string][]) {
        ticket.a3[field] = value;
        ticket.aiPrefilledFields = ticket.aiPrefilledFields.filter((item) => item !== field);
      }
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not update the A3." };
  } finally {
    revalidatePaths(["/kaizen", `/kaizen/${ticketId}`]);
  }
}

export async function advanceTicket(ticketId: string): Promise<ActionResult> {
  try {
    if (!isValidId(ticketId)) return { ok: false, error: "Invalid ticket ID." };
    if ((await getCurrentRole()) !== "engineer") {
      return { ok: false, error: "Only the owner engineer can advance the ticket." };
    }

    return await getStore().mutate<ActionResult>((draft) => {
      const ticket = draft.tickets.find((item) => item.id === ticketId);
      if (!ticket) return { ok: false, error: "Kaizen ticket not found." };
      const nextStatus = getNextTicketStatus(ticket);
      if (!nextStatus) return { ok: false, error: "Ticket cannot advance from its current state." };
      ticket.status = nextStatus;
      if (nextStatus === "closed") ticket.closedAt = nextSimulatedTimestamp(draft);
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not advance the ticket." };
  } finally {
    revalidatePaths(["/kaizen", `/kaizen/${ticketId}`, "/knowledge"]);
  }
}

export async function requestValidation(ticketId: string): Promise<ActionResult> {
  try {
    if (!isValidId(ticketId)) return { ok: false, error: "Invalid ticket ID." };
    if ((await getCurrentRole()) !== "engineer") {
      return { ok: false, error: "Only the owner engineer can request validation." };
    }

    return await getStore().mutate<ActionResult>((draft) => {
      const ticket = draft.tickets.find((item) => item.id === ticketId);
      if (!ticket) return { ok: false, error: "Kaizen ticket not found." };
      if (ticket.status !== "countermeasure_trial") {
        return { ok: false, error: "Complete the countermeasure trial before validation." };
      }
      if (!isA3Complete(ticket.a3)) {
        return { ok: false, error: "Complete all six A3 sections before validation." };
      }
      if (draft.cards.some((card) => card.sourceTicketId === ticket.id && card.status === "draft")) {
        return { ok: false, error: "This ticket already has a draft awaiting validation." };
      }
      const station = draft.stations.find((item) => item.id === ticket.stationId);
      const defectType = draft.defectTypes.find((item) => item.id === ticket.defectTypeId);
      draft.cards.push({
        id: nextKnowledgeCardId(draft.cards),
        revision: 1,
        status: "draft",
        process: station?.type === "sealer" ? "Sealer" : (station?.name ?? "Body"),
        stationIds: [ticket.stationId],
        variants: [station?.line.split("-")[0] ?? "K2"],
        factor4M: draftFactor(),
        symptom: defectType?.name ?? ticket.defectTypeId,
        rootCause: ticket.a3.rootCause,
        countermeasure: ticket.a3.countermeasure,
        standardRevised: ticket.a3.standardise,
        sourceTicketId: ticket.id,
      });
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not request validation." };
  } finally {
    revalidatePaths(["/kaizen", `/kaizen/${ticketId}`, "/knowledge"]);
  }
}
