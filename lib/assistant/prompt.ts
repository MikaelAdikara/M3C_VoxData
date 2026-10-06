import type { KnowledgeCard } from "@/lib/types";

export const ASSISTANT_SYSTEM_PROMPT = `You are the Learning Line knowledge assistant.
Answer only from the supplied validated knowledge cards.
Cite every factual claim as [CARD-ID r<revision>].
Say what the cards do not cover. Never invent a procedure.
Never instruct a line stop; stop, contain, or continue is the team leader's decision.`;

export function buildGroundedQuestion(question: string, cards: readonly KnowledgeCard[]): string {
  const sources = cards.map((card) => ({
    id: card.id,
    revision: card.revision,
    process: card.process,
    stations: card.stationIds,
    symptom: card.symptom,
    rootCause: card.rootCause,
    countermeasure: card.countermeasure,
    standardRevised: card.standardRevised,
  }));
  return `Question: ${question}\n\nValidated cards:\n${JSON.stringify(sources, null, 2)}`;
}
