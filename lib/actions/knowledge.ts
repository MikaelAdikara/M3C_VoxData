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
import type { ActionResult, Actor, KnowledgeCard } from "@/lib/types";

const MAX_RETURN_COMMENT_LENGTH = 500;
const MAX_QUESTION_LENGTH = 500;

function latestCard(cards: readonly KnowledgeCard[], cardId: string): KnowledgeCard | undefined {
  return cards
    .filter((card) => card.id === cardId)
    .sort((left, right) => right.revision - left.revision)[0];
}

export async function validateCard(cardId: string): Promise<ActionResult> {
  try {
    if (!isValidId(cardId)) return { ok: false, error: "Invalid card ID." };
    if ((await getCurrentRole()) !== "senior_expert") {
      return { ok: false, error: "Only the senior expert can validate a knowledge card." };
    }

    return await getStore().mutate<ActionResult>((draft) => {
      const card = latestCard(draft.cards, cardId);
      if (!card) return { ok: false, error: "Knowledge card not found." };
      if (card.status !== "draft") {
        return { ok: false, error: "Only the latest draft can be validated." };
      }
      if (card.returnedAt) {
        return { ok: false, error: "Returned draft must be revised and submitted again." };
      }
      const sourceTicket = card.sourceTicketId
        ? draft.tickets.find((item) => item.id === card.sourceTicketId)
        : undefined;
      if (card.sourceTicketId && sourceTicket?.status !== "countermeasure_trial") {
        return { ok: false, error: "Source ticket is not ready for validation." };
      }
      const validatedAt = nextSimulatedTimestamp(draft);
      draft.cards.push({
        ...card,
        revision: card.revision + 1,
        status: "validated",
        validatedByRole: "role:senior_expert@body",
        validatedAt,
        returnedComment: undefined,
        returnedByRole: undefined,
        returnedAt: undefined,
      });
      if (sourceTicket) sourceTicket.status = "validated";
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not validate the knowledge card." };
  } finally {
    revalidatePaths(["/", "/knowledge", "/kaizen", "/metrics"]);
  }
}

export async function returnCard(cardId: string, comment: string): Promise<ActionResult> {
  try {
    if (!isValidId(cardId)) return { ok: false, error: "Invalid card ID." };
    const normalized = normalizeRequiredText(comment, MAX_RETURN_COMMENT_LENGTH);
    if (!normalized || normalized.length < 3) {
      return { ok: false, error: "A meaningful return comment is required." };
    }
    if ((await getCurrentRole()) !== "senior_expert") {
      return { ok: false, error: "Only the senior expert can return a knowledge card." };
    }

    return await getStore().mutate<ActionResult>((draft) => {
      const card = latestCard(draft.cards, cardId);
      if (!card) return { ok: false, error: "Knowledge card not found." };
      if (card.status !== "draft") return { ok: false, error: "Only a draft can be returned." };
      if (card.returnedAt) return { ok: false, error: "This draft has already been returned." };
      card.returnedComment = normalized;
      card.returnedByRole = "role:senior_expert@body";
      card.returnedAt = nextSimulatedTimestamp(draft);
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not return the knowledge card." };
  } finally {
    revalidatePaths(["/", "/knowledge", "/kaizen", "/metrics"]);
  }
}

type CardRevisionPatch = Pick<KnowledgeCard, "rootCause" | "countermeasure" | "standardRevised">;

/** Engineer revision path for standalone draft cards; ticket cards are revised through their A3. */
export async function reviseReturnedCard(cardId: string, patch: CardRevisionPatch): Promise<ActionResult> {
  try {
    if (!isValidId(cardId)) return { ok: false, error: "Invalid card ID." };
    if (!patch || typeof patch !== "object") return { ok: false, error: "Invalid card revision." };
    const rootCause = normalizeRequiredText(patch.rootCause, 2_000);
    const countermeasure = normalizeRequiredText(patch.countermeasure, 2_000);
    const standardRevised = normalizeRequiredText(patch.standardRevised, 2_000);
    if (!rootCause || !countermeasure || !standardRevised) {
      return { ok: false, error: "Complete the root cause, countermeasure, and revised standard." };
    }
    if ((await getCurrentRole()) !== "engineer") {
      return { ok: false, error: "Only the owner engineer can revise a returned knowledge card." };
    }

    return await getStore().mutate<ActionResult>((draft) => {
      const card = latestCard(draft.cards, cardId);
      if (!card) return { ok: false, error: "Knowledge card not found." };
      if (card.sourceTicketId) return { ok: false, error: "Revise the source ticket A3 instead." };
      if (card.status !== "draft" || !card.returnedAt) {
        return { ok: false, error: "Only a returned standalone draft can be revised." };
      }
      draft.cards.push({
        ...card,
        revision: card.revision + 1,
        rootCause,
        countermeasure,
        standardRevised,
        returnedComment: undefined,
        returnedByRole: undefined,
        returnedAt: undefined,
      });
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not revise the knowledge card." };
  } finally {
    revalidatePaths(["/", "/knowledge", "/metrics"]);
  }
}

export async function routeToOwner(question: string): Promise<ActionResult> {
  try {
    const normalized = normalizeRequiredText(question, MAX_QUESTION_LENGTH);
    if (!normalized) return { ok: false, error: "Question must be between 1 and 500 characters." };
    const role = await getCurrentRole();
    return await getStore().mutate<ActionResult>((draft) => {
      draft.routedQuestions.push({
        id: nextEntityId("question", draft.routedQuestions.map((item) => item.id)),
        question: normalized,
        requestedByRole: `role:${role}@body` as Actor,
        ownerRole: "role:engineer@body",
        status: "routed",
        createdAt: nextSimulatedTimestamp(draft),
      });
      return { ok: true };
    });
  } catch {
    return { ok: false, error: "Could not route the question to the owner engineer." };
  } finally {
    revalidatePaths(["/knowledge"]);
  }
}
