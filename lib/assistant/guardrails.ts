import type { KnowledgeCard } from "@/lib/types";

const CITATION_PATTERN = /\[([A-Z0-9-]+) r(\d+)\]/g;

export function validateGroundedAnswer(text: string, suppliedCards: readonly KnowledgeCard[]): boolean {
  const allowed = new Set(suppliedCards.map((card) => `${card.id}:r${card.revision}`));
  const citations = [...text.matchAll(CITATION_PATTERN)];
  if (citations.length === 0) return false;
  if (citations.some((match) => !allowed.has(`${match[1]}:r${match[2]}`))) return false;
  if (/\b(stop the line|automatic line stop|shut down the line)\b/i.test(text)) return false;
  return true;
}
