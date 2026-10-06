import type { Alert, Decision, Idea, KnowledgeCard, Ticket } from "@/lib/types";

const DAY_MS = 86_400_000;

export function calculateOverrideRate(confirmed: number, rejected: number): number {
  const denominator = confirmed + rejected;
  return denominator === 0 ? 0 : rejected / denominator;
}

export function calculateOverrideRateForAlerts(
  alerts: readonly Alert[],
  decisions: readonly Decision[],
): number {
  const confirmed = alerts.filter(
    (alert) =>
      alert.status === "confirmed" ||
      alert.status === "closed" ||
      decisions.some((decision) => decision.alertId === alert.id && decision.kind === "confirm"),
  ).length;
  const rejected = alerts.filter(
    (alert) =>
      alert.status === "rejected" ||
      decisions.some((decision) => decision.alertId === alert.id && decision.kind === "reject"),
  ).length;
  return calculateOverrideRate(confirmed, rejected);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function calculateLearningCycleTimes(
  tickets: readonly Ticket[],
  cards: readonly KnowledgeCard[],
  alerts: readonly Alert[],
): number[] {
  return tickets.flatMap((ticket) => {
    const validatedCard = cards
      .filter(
        (card) =>
          card.sourceTicketId === ticket.id &&
          card.status === "validated" &&
          card.validatedAt !== undefined,
      )
      .sort((left, right) => right.revision - left.revision)[0];
    if (!validatedCard?.validatedAt) return [];
    const triggerTimes = ticket.triggerAlertIds
      .map((alertId) => alerts.find((alert) => alert.id === alertId)?.createdAt)
      .filter((createdAt): createdAt is string => createdAt !== undefined)
      .map(Date.parse)
      .filter(Number.isFinite);
    if (triggerTimes.length !== ticket.triggerAlertIds.length || triggerTimes.length === 0) return [];
    const elapsed = Date.parse(validatedCard.validatedAt) - Math.min(...triggerTimes);
    return elapsed >= 0 ? [elapsed / DAY_MS] : [];
  });
}

export function calculateIdeaMetrics(ideas: readonly Idea[]): {
  submitted: number;
  answeredWithin7Days: number;
  implemented: number;
} {
  return {
    submitted: ideas.length,
    answeredWithin7Days: ideas.filter(
      (idea) =>
        idea.answeredAt !== undefined &&
        Date.parse(idea.answeredAt) >= Date.parse(idea.createdAt) &&
        Date.parse(idea.answeredAt) - Date.parse(idea.createdAt) <= 7 * DAY_MS,
    ).length,
    implemented: ideas.filter((idea) => idea.status === "implemented").length,
  };
}
