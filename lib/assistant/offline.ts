import type { AssistantAnswer, KnowledgeCard } from "@/lib/types";

export function offlineAnswer(card: KnowledgeCard): AssistantAnswer {
  const citation = `[${card.id} r${card.revision}]`;
  return {
    mode: "offline",
    text: `${card.countermeasure} ${citation}`,
    citations: [{ cardId: card.id, revision: card.revision }],
  };
}

export function noCardAnswer(): AssistantAnswer {
  return {
    mode: "no_card",
    text: "No validated card covers this. Route the question to the owner engineer.",
    citations: [],
  };
}
