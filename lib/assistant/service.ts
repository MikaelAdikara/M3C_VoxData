import { validateGroundedAnswer } from "@/lib/assistant/guardrails";
import type { LiveDraft } from "@/lib/assistant/live";
import { noCardAnswer, offlineAnswer } from "@/lib/assistant/offline";
import { retrieveValidatedCards } from "@/lib/assistant/retrieve";
import type { AssistantAnswer, KnowledgeCard } from "@/lib/types";

/** Live model hook: plain text with [ID rN] citations, or a structured draft (lib/assistant/live.ts). */
export type LiveAnswerGenerator = (
  question: string,
  cards: readonly KnowledgeCard[],
) => Promise<string | LiveDraft>;

const tag = (c: { cardId: string; revision: number }) => `[${c.cardId} r${c.revision}]`;

/** Structured draft -> text, or null when any sentence lacks a citation to a supplied card. */
function draftToText(draft: LiveDraft, supplied: readonly KnowledgeCard[]): string | null {
  const allowed = new Set(supplied.map((card) => `${card.id}:${card.revision}`));
  const parts: string[] = [];
  for (const sentence of draft.sentences) {
    const text = sentence.text.trim();
    if (!text) continue;
    if (sentence.citations.length === 0) return null;
    if (sentence.citations.some((c) => !allowed.has(`${c.cardId}:${c.revision}`))) return null;
    const cites = sentence.citations.map(tag).filter((t) => !text.includes(t));
    parts.push(cites.length ? `${text} ${cites.join(" ")}` : text);
  }
  return parts.length ? parts.join(" ") : null;
}

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
    const draft = await generateLive(question, supplied);
    // The model may judge that the retrieved cards are about something else: then no card covers it.
    if (typeof draft !== "string" && !draft.covered) return noCardAnswer();
    const text = typeof draft === "string" ? draft.trim() : draftToText(draft, supplied);
    if (!text || !validateGroundedAnswer(text, supplied)) return offlineAnswer(supplied[0]);
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
