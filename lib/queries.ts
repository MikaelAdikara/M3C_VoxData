import { cookies } from "next/headers";

import { DEFAULT_ROLE, isRole, ROLE_COOKIE_NAME } from "@/lib/role-cookie";
import { getFalseAlarmBudgetState } from "@/lib/rules/budget";
import {
  calculateIdeaMetrics,
  calculateLearningCycleTimes,
  calculateOverrideRate,
  calculateOverrideRateForAlerts,
  median,
} from "@/lib/rules/metrics";
import { getShiftRecommendation } from "@/lib/rules/recommend";
import { getConfirmedRepeatState, isConfirmedAlert } from "@/lib/rules/repeat";
import { isA3Complete } from "@/lib/rules/lifecycle";
import { getStore } from "@/lib/store";
import type {
  Alert,
  AlertView,
  CardStatus,
  CardView,
  Decision,
  DecisionView,
  DefectType,
  DefectTypeId,
  KaizenView,
  KnowledgeCard,
  KnowledgeFilters,
  KnowledgeView,
  MetricsView,
  ReasonCodeOption,
  RecommendationView,
  Role,
  ShiftBoardView,
  StationDecisionHistoryItem,
  StationView,
  TicketView,
} from "@/lib/types";

export const reasonCodes: ReasonCodeOption[] = [
  { value: "reflection", label: "Reflection" },
  { value: "variant_mismatch", label: "Variant mismatch" },
  { value: "dirty_lens", label: "Dirty lens" },
  { value: "within_tolerance", label: "Bead within tolerance" },
  { value: "other", label: "Other" },
];

function toAlertView(
  alert: Alert,
  defectTypes: Map<string, DefectType>,
  recommendation: RecommendationView | null = null,
): AlertView {
  return {
    id: alert.id,
    stationId: alert.stationId,
    bodyId: alert.bodyId,
    roi: alert.roi,
    defectType: alert.defectTypeId ? (defectTypes.get(alert.defectTypeId) ?? null) : null,
    anomalyScore: alert.anomalyScore,
    threshold: alert.threshold,
    modelVersion: alert.modelVersion,
    image: alert.image,
    mask: alert.mask,
    createdAt: alert.createdAt,
    status: alert.status,
    recommendation,
  };
}

function toDecisionView(decision: Decision): DecisionView {
  return {
    kind: decision.kind,
    actor: decision.actor,
    reasonCode: decision.reasonCode,
    note: decision.note,
    createdAt: decision.createdAt,
  };
}

function isWithinRange(createdAt: string, startsAt: string, endsAt: string): boolean {
  const timestamp = Date.parse(createdAt);
  return timestamp >= Date.parse(startsAt) && timestamp <= Date.parse(endsAt);
}

function toCardView(card: KnowledgeCard, revisions: readonly KnowledgeCard[]): CardView {
  return {
    ...card,
    revisions: [...revisions]
      .sort((left, right) => right.revision - left.revision)
      .map((item) => ({
        revision: item.revision,
        status: item.status,
        validatedByRole: item.validatedByRole,
        validatedAt: item.validatedAt,
        returnedComment: item.returnedComment,
        returnedByRole: item.returnedByRole,
        returnedAt: item.returnedAt,
      })),
  };
}

export async function getCurrentRole(): Promise<Role> {
  try {
    const value = (await cookies()).get(ROLE_COOKIE_NAME)?.value;
    return isRole(value) ? value : DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
}

export async function getStationView(stationId: string): Promise<StationView | null> {
  const snapshot = await getStore().getSnapshot();
  const station = snapshot.stations.find((item) => item.id === stationId);
  if (!station) return null;

  const defectTypesById = new Map(snapshot.defectTypes.map((item) => [item.id, item]));
  const openAlert = snapshot.alerts
    .filter((alert) => alert.stationId === stationId && alert.status === "open")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const shiftAlerts = snapshot.alerts.filter(
    (alert) =>
      alert.stationId === stationId &&
      isWithinRange(alert.createdAt, snapshot.currentShift.startsAt, snapshot.currentShift.endsAt),
  );
  const decisionHistory = shiftAlerts
    .map((alert): StationDecisionHistoryItem | null => {
      const alertDecisions = snapshot.decisions.filter((item) => item.alertId === alert.id);
      const operatorDecision = alertDecisions.find(
        (decision) => decision.kind === "confirm" || decision.kind === "reject",
      );
      if (!operatorDecision) return null;
      const teamLeaderDecision = alertDecisions.find((decision) =>
        ["stop_fix", "contain", "continue"].includes(decision.kind),
      );
      return {
        alert: toAlertView(alert, defectTypesById),
        operatorDecision: toDecisionView(operatorDecision),
        teamLeaderDecision: teamLeaderDecision ? toDecisionView(teamLeaderDecision) : null,
        occurredAt: teamLeaderDecision?.createdAt ?? operatorDecision.createdAt,
      };
    })
    .filter((item): item is StationDecisionHistoryItem => item !== null)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

  return {
    station,
    openAlert: openAlert ? toAlertView(openAlert, defectTypesById) : null,
    reasonCodes,
    ideasOpen: snapshot.ideas.filter(
      (idea) => idea.stationId === stationId && idea.status === "submitted",
    ).length,
    decisionHistory,
  };
}

export async function getShiftBoardView(): Promise<ShiftBoardView> {
  const snapshot = await getStore().getSnapshot();
  const { startsAt, endsAt } = snapshot.currentShift;
  const shiftStart = Date.parse(startsAt);
  const shiftEnd = Date.parse(endsAt);
  const shiftAlerts = snapshot.alerts.filter(
    (alert) => {
      const createdAt = Date.parse(alert.createdAt);
      return createdAt >= shiftStart && createdAt <= shiftEnd;
    },
  );
  const defectTypesById = new Map(snapshot.defectTypes.map((item) => [item.id, item]));

  return {
    shift: snapshot.currentShift,
    stations: snapshot.stations.map((station) => {
      const stationAlerts = shiftAlerts.filter((alert) => alert.stationId === station.id);
      const confirmedCount = stationAlerts.filter((alert) =>
        isConfirmedAlert(alert, snapshot.decisions),
      ).length;
      const budget = getFalseAlarmBudgetState(
        shiftAlerts,
        snapshot.decisions,
        station.id,
        snapshot.currentShift,
      );

      return {
        station,
        openAlerts: stationAlerts.filter((alert) => alert.status === "open").length,
        confirmedCount,
        rejectedCount: budget.count,
        falseAlarmBudget: budget.budget,
        modelReviewNeeded: budget.exceeded,
        overrideRate: calculateOverrideRate(confirmedCount, budget.count),
      };
    }),
    pendingDecisions: shiftAlerts
      .filter(
        (alert) =>
          alert.status === "confirmed" &&
          !snapshot.decisions.some(
            (decision) =>
              decision.alertId === alert.id &&
              ["stop_fix", "contain", "continue"].includes(decision.kind),
          ),
      )
      .map((alert) => {
        const defectType = alert.defectTypeId ? defectTypesById.get(alert.defectTypeId) : undefined;
        const repeatCount = alert.defectTypeId
          ? getConfirmedRepeatState(
              shiftAlerts,
              snapshot.decisions,
              alert.stationId,
              alert.defectTypeId,
              snapshot.currentShift,
            ).count
          : 0;
        const recommendation = defectType
          ? getShiftRecommendation(defectType.criticality, repeatCount)
          : null;
        return toAlertView(alert, defectTypesById, recommendation);
      }),
    modelReviews: snapshot.modelReviews
      .filter((review) =>
        review.alertIds.some((alertId) => shiftAlerts.some((alert) => alert.id === alertId)),
      )
      .map((review) => ({
        id: review.id,
        stationId: review.stationId,
        alertIds: [...review.alertIds],
        status: review.status,
        verifiedByRole: review.verifiedByRole,
        verifiedAt: review.verifiedAt,
        eligibleForModelUpdate: review.eligibleForModelUpdate,
      })),
  };
}

export async function getKaizenView(): Promise<KaizenView> {
  const snapshot = await getStore().getSnapshot();
  const defectTypesById = new Map(snapshot.defectTypes.map((item) => [item.id, item]));
  const end = Date.parse(snapshot.currentShift.endsAt);
  const start = end - 30 * 86_400_000;
  const counts = new Map<DefectTypeId, number>();
  for (const alert of snapshot.alerts) {
    const createdAt = Date.parse(alert.createdAt);
    if (
      alert.defectTypeId &&
      createdAt >= start &&
      createdAt <= end &&
      isConfirmedAlert(alert, snapshot.decisions)
    ) {
      counts.set(alert.defectTypeId, (counts.get(alert.defectTypeId) ?? 0) + 1);
    }
  }

  return {
    pareto: [...counts.entries()]
      .map(([defectTypeId, count]) => ({ defectType: defectTypesById.get(defectTypeId)!, count }))
      .filter((item) => item.defectType !== undefined)
      .sort((left, right) => right.count - left.count),
    tickets: snapshot.tickets
      .filter((ticket) => ticket.status !== "closed")
      .map((ticket) => ({
        id: ticket.id,
        stationId: ticket.stationId,
        defectType: defectTypesById.get(ticket.defectTypeId)!,
        ownerRole: ticket.ownerRole,
        status: ticket.status,
        createdAt: ticket.createdAt,
      }))
      .filter((ticket) => ticket.defectType !== undefined)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

export async function getTicketView(id: string): Promise<TicketView | null> {
  const snapshot = await getStore().getSnapshot();
  const ticket = snapshot.tickets.find((item) => item.id === id);
  if (!ticket) return null;
  const defectTypesById = new Map(snapshot.defectTypes.map((item) => [item.id, item]));
  const defectType = defectTypesById.get(ticket.defectTypeId);
  if (!defectType) return null;
  const draft = snapshot.cards
    .filter((card) => card.sourceTicketId === ticket.id && card.status === "draft")
    .sort((left, right) => right.revision - left.revision)[0];
  const requiredFieldsComplete = isA3Complete(ticket.a3);
  return {
    ticket,
    defectType,
    triggerAlerts: ticket.triggerAlertIds
      .map((alertId) => snapshot.alerts.find((alert) => alert.id === alertId))
      .filter((alert): alert is Alert => alert !== undefined)
      .map((alert) => toAlertView(alert, defectTypesById)),
    a3: ticket.a3,
    aiPrefilledFields: [...ticket.aiPrefilledFields],
    validation: {
      requiredFieldsComplete,
      draftCardId: draft?.id ?? null,
      canRequest:
        ticket.status === "countermeasure_trial" && requiredFieldsComplete && draft === undefined,
    },
  };
}

export async function getKnowledgeView(filters: KnowledgeFilters = {}): Promise<KnowledgeView> {
  const snapshot = await getStore().getSnapshot();
  const grouped = new Map<string, KnowledgeCard[]>();
  for (const card of snapshot.cards) {
    grouped.set(card.id, [...(grouped.get(card.id) ?? []), card]);
  }
  const currentCards = [...grouped.values()].map((revisions) =>
    [...revisions].sort((left, right) => right.revision - left.revision)[0],
  );
  const cards = currentCards
    .filter((card) => !filters.process || card.process === filters.process)
    .filter((card) => !filters.stationId || card.stationIds.includes(filters.stationId))
    .filter((card) => !filters.status || card.status === filters.status)
    .map((card) => toCardView(card, grouped.get(card.id) ?? []))
    .sort((left, right) => left.id.localeCompare(right.id));
  const statuses: CardStatus[] = ["draft", "validated", "retired"];

  return {
    cards,
    filters: {
      processes: Array.from(new Set(currentCards.map((card) => card.process))).sort(),
      stations: snapshot.stations.filter((station) =>
        currentCards.some((card) => card.stationIds.includes(station.id)),
      ),
      statuses,
      selected: filters,
    },
  };
}

export async function getMetricsView(): Promise<MetricsView> {
  const snapshot = await getStore().getSnapshot();
  const falseAlarms = snapshot.stations.map((station) => {
    const budget = getFalseAlarmBudgetState(
      snapshot.alerts,
      snapshot.decisions,
      station.id,
      snapshot.currentShift,
    );
    return {
      station,
      count: budget.count,
      budget: budget.budget,
      withinBudget: !budget.exceeded,
    };
  });

  const completedAlerts = snapshot.alerts.filter(
    (alert) => Date.parse(alert.createdAt) < Date.parse(snapshot.currentShift.startsAt),
  );
  const latestCompletedDate = completedAlerts
    .map((alert) => alert.createdAt.slice(0, 10))
    .sort()
    .at(-1);
  const latestCompletedDayAlerts = latestCompletedDate
    ? completedAlerts.filter((alert) => alert.createdAt.startsWith(latestCompletedDate))
    : [];
  const currentOverridePercent = Math.round(
    calculateOverrideRateForAlerts(latestCompletedDayAlerts, snapshot.decisions) * 100,
  );
  const learningCycleDays = median(
    calculateLearningCycleTimes(snapshot.tickets, snapshot.cards, snapshot.alerts),
  );
  const ideas = calculateIdeaMetrics(snapshot.ideas);
  const stationsWithinBudget = falseAlarms.filter((item) => item.withinBudget).length;

  return {
    gate1: [
      {
        id: "false-alarms",
        label: "False alarms per station per shift",
        value: `${stationsWithinBudget} of ${falseAlarms.length} within`,
        unit: "stations",
        baseline: "n/a",
        target: "≤ 2 per station per shift",
        sourceLabel: "ES Gate 1",
      },
      {
        id: "override-rate",
        label: "Operators overriding alerts",
        value: currentOverridePercent,
        unit: "%",
        baseline: 31,
        target: "< 20%",
        sourceLabel: "Casebook survey; ES Section 3",
      },
      {
        id: "limit-sample-detection",
        label: "Detection on seeded limit samples",
        value: "Not run",
        unit: "",
        baseline: "n/a",
        target: "59 per defect type",
        sourceLabel: "ES Appendix H",
      },
      {
        id: "scrap-index",
        label: "Scrap index (2023 = 100)",
        value: "Not measured",
        unit: "index",
        baseline: 108,
        target: 96,
        sourceLabel: "Casebook Exhibit 4; ES Table 4",
      },
      {
        id: "operator-help",
        label: "Operators saying technology helps",
        value: "Survey due",
        unit: "%",
        baseline: 54,
        target: "≥ 75%",
        sourceLabel: "Casebook survey; ES Gate 1",
      },
    ],
    falseAlarms,
    overrideRate: {
      baselinePercent: 31,
      currentPercent: currentOverridePercent,
      gate1TargetPercent: 20,
      year2030TargetPercent: 10,
      periodLabel: "Latest completed simulated day",
    },
    learningCycleDays,
    ideas,
    dataLabel: "Simulated data",
  };
}
