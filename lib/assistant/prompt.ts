import type { KnowledgeCard } from "@/lib/types";

export const ASSISTANT_SYSTEM_PROMPT = `You are the Learning Line knowledge assistant for team leaders on a car-body sealer line.
Answer only from the validated knowledge cards supplied with the question. They are the plant's checked know-how; anything else is not.

Return JSON:
- covered: true only if the cards actually answer this question (same symptom and situation). If they are about something else, set covered to false and leave sentences empty; the question then goes to the owner engineer.
- sentences: a short answer, at most four sentences. Each sentence lists the card IDs and revisions that support it. Write nothing a cited card does not say.

Never invent a procedure, setting or number. Never tell anyone to stop the line: stop, contain or continue is the team leader's decision.`;

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
