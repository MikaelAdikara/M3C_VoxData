import { validateGroundedAnswer } from "@/lib/assistant/guardrails";
import { noCardAnswer, offlineAnswer } from "@/lib/assistant/offline";
import { retrieveValidatedCards } from "@/lib/assistant/retrieve";
import type { AssistantAnswer, KnowledgeCard } from "@/lib/types";

export type LiveAnswerGenerator = (
  question: string,
  cards: readonly KnowledgeCard[],
) => Promise<string>;

export async function answerAssistantQuestion(
  question: string,
  cards: readonly KnowledgeCard[],
  generateLive?: LiveAnswerGenerator,
): Promise<AssistantAnswer> {
  const matches = retrieveValidatedCards(cards, question);
  if (matches.length === 0) return noCardAnswer();
  const supplied = matches.map((match) => match.card);
  if (!generateLive) return offlineAnswer(supplied[0]);

  try {
    const text = (await generateLive(question, supplied)).trim();
    if (!validateGroundedAnswer(text, supplied)) return offlineAnswer(supplied[0]);
    const citations = Array.from(
      new Map(
        [...text.matchAll(/\[([A-Z0-9-]+) r(\d+)\]/g)].map((match) => [
          `${match[1]}:${match[2]}`,
          { cardId: match[1], revision: Number(match[2]) },
        ]),
      ).values(),
    );
    return { mode: "live", text, citations };
  } catch {
    return offlineAnswer(supplied[0]);
  }
}
