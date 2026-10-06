import type { KnowledgeCard } from "@/lib/types";

export const RETRIEVAL_THRESHOLD = 0.35;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "at", "do", "for", "from", "getting", "how", "i", "in",
  "is", "it", "near", "of", "on", "the", "to", "we", "what", "why", "with",
]);

function normalizeToken(token: string): string {
  if (/^st-?\d+$/.test(token)) return token.replace("-", "");
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

export function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .match(/[a-z0-9]+(?:-[a-z0-9]+)*/g)
        ?.map(normalizeToken)
        .filter((token) => !STOP_WORDS.has(token)) ?? [],
    ),
  );
}

export interface RetrievedCard {
  card: KnowledgeCard;
  score: number;
}

function latestValidated(cards: readonly KnowledgeCard[]): KnowledgeCard[] {
  const grouped = new Map<string, KnowledgeCard[]>();
  for (const card of cards) {
    grouped.set(card.id, [...(grouped.get(card.id) ?? []), card]);
  }
  return [...grouped.values()].flatMap((revisions) => {
    const newest = [...revisions].sort((left, right) => right.revision - left.revision)[0];
    if (newest.status === "retired") return [];
    const validated = revisions
      .filter((card) => card.status === "validated")
      .sort((left, right) => right.revision - left.revision)[0];
    return validated ? [validated] : [];
  });
}

export function retrieveValidatedCards(
  cards: readonly KnowledgeCard[],
  question: string,
  limit = 3,
): RetrievedCard[] {
  const queryTokens = tokenize(question);
  if (queryTokens.length === 0) return [];

  return latestValidated(cards)
    .map((card) => {
      const weightedFields = [
        { weight: 3, tokens: tokenize(card.symptom) },
        { weight: 2, tokens: tokenize(card.rootCause) },
        { weight: 2, tokens: tokenize(card.countermeasure) },
        { weight: 1, tokens: tokenize(card.process) },
        { weight: 4, tokens: tokenize(card.stationIds.join(" ")) },
        { weight: 2, tokens: tokenize(card.variants.join(" ")) },
      ];
      let matched = 0;
      let weightedMatch = 0;
      for (const token of queryTokens) {
        const bestWeight = weightedFields.reduce(
          (best, field) => (field.tokens.includes(token) ? Math.max(best, field.weight) : best),
          0,
        );
        if (bestWeight > 0) {
          matched += 1;
          weightedMatch += bestWeight;
        }
      }
      const coverage = matched / queryTokens.length;
      const specificity = weightedMatch / (queryTokens.length * 4);
      return { card, score: Number((coverage * 0.8 + specificity * 0.2).toFixed(4)) };
    })
    .filter((candidate) => candidate.score >= RETRIEVAL_THRESHOLD)
    .sort((left, right) => right.score - left.score || left.card.id.localeCompare(right.card.id))
    .slice(0, limit);
}
