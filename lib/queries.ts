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
import { buildCameraView, buildLineView, buildPilotView, buildTrailView } from "@/lib/be4-views";
import { fingerprintSnapshot, seedFingerprint, SEED_VERSION } from "@/lib/seed-identity";
import { SEED_REFERENCE_CLOCK } from "@/lib/seed";
import type {
  Alert,
  AlertView,
  CardStatus,
  CardView,
  CameraView,
  Decision,
  DecisionView,
  DefectType,
  DefectTypeId,
  KaizenView,
  KnowledgeCard,
  KnowledgeFilters,
  KnowledgeView,
  MetricsView,
  LineView,
  OverviewView,
  PilotView,
  ReasonCodeOption,
  RecommendationView,
  Role,
  SimulatorView,
  ShiftBoardView,
  StationDecisionHistoryItem,
  StationView,
  StoreSnapshot,
  TicketView,
  TrailView,
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
    visualScenarioId: alert.visualScenarioId,
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
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
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
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));

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
  return buildShiftBoardView(await getStore().getSnapshot());
}

export function buildShiftBoardView(snapshot: StoreSnapshot): ShiftBoardView {
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
              shiftAlerts.filter((item) => Date.parse(item.createdAt) <= Date.parse(alert.createdAt)),
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
  return buildKaizenView(await getStore().getSnapshot());
}

export function buildKaizenView(snapshot: StoreSnapshot): KaizenView {
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
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
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
  return buildMetricsView(await getStore().getSnapshot());
}

export function buildMetricsView(snapshot: StoreSnapshot): MetricsView {
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
      provenance: "simulated" as const,
      sourceLabel: "Simulated current shift",
      budgetProvenance: "target" as const,
      budgetSourceLabel: "ES Gate 1",
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
  const kaizen = buildKaizenView(snapshot);
  const paretoTotal = kaizen.pareto.reduce((sum, item) => sum + item.count, 0);
  const ticketStatuses = ["open", "a3_in_progress", "countermeasure_trial", "validated", "closed"] as const;
  const cardsById = new Map<string, KnowledgeCard>();
  for (const card of snapshot.cards) {
    if ((cardsById.get(card.id)?.revision ?? -1) < card.revision) cardsById.set(card.id, card);
  }
  const cardStatuses = ["draft", "validated", "retired"] as const;

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
        provenance: "simulated",
        targetProvenance: "target",
        targetSourceLabel: "ES Gate 1",
      },
      {
        id: "override-rate",
        label: "Operators overriding alerts",
        value: currentOverridePercent,
        unit: "%",
        baseline: 31,
        target: "< 20%",
        sourceLabel: "Casebook survey; ES Section 3",
        provenance: "simulated",
        baselineProvenance: "case_data",
        baselineSourceLabel: "Casebook survey",
        targetProvenance: "target",
        targetSourceLabel: "ES Gate 1",
      },
      {
        id: "limit-sample-detection",
        label: "Detection on seeded limit samples",
        value: "Not run",
        unit: "",
        baseline: "n/a",
        target: "59 per defect type",
        sourceLabel: "ES Appendix H",
        provenance: "simulated",
        targetProvenance: "target",
        targetSourceLabel: "ES Appendix H",
      },
      {
        id: "scrap-index",
        label: "Scrap index (2023 = 100)",
        value: "Not measured",
        unit: "index",
        baseline: 108,
        target: 96,
        sourceLabel: "Casebook Exhibit 4; ES Table 4",
        provenance: "case_data",
        baselineProvenance: "case_data",
        baselineSourceLabel: "Casebook Exhibit 4",
        targetProvenance: "target",
        targetSourceLabel: "ES Table 4",
      },
      {
        id: "operator-help",
        label: "Operators saying technology helps",
        value: "Survey due",
        unit: "%",
        baseline: 54,
        target: "≥ 75%",
        sourceLabel: "Casebook survey; ES Gate 1",
        provenance: "case_data",
        baselineProvenance: "case_data",
        baselineSourceLabel: "Casebook survey",
        targetProvenance: "target",
        targetSourceLabel: "ES Gate 1",
      },
    ],
    falseAlarms,
    overrideRate: {
      baselinePercent: 31,
      currentPercent: currentOverridePercent,
      gate1TargetPercent: 20,
      year2030TargetPercent: 10,
      periodLabel: "Latest completed simulated day",
      provenance: "simulated",
      sourceLabel: "Simulated 30-day history",
      baselineProvenance: "case_data",
      baselineSourceLabel: "Casebook survey",
      targetProvenance: "target",
      targetSourceLabel: "ES Gate 1",
    },
    learningCycleDays,
    learningCycle: { days: learningCycleDays, provenance: "simulated", sourceLabel: "Simulated ticket-to-card history" },
    ideas: { ...ideas, provenance: "simulated", sourceLabel: "Simulated idea history" },
    dataLabel: "Simulated data",
    provenance: "simulated",
    sourceLabel: "Simulated K2-Body demo state",
    pareto: kaizen.pareto.map((item) => ({ ...item, percent: paretoTotal ? Math.round(item.count / paretoTotal * 100) : 0, provenance: "simulated", sourceLabel: "Simulated 30-day history" })),
    ticketProgress: ticketStatuses.map((status) => ({ status, count: snapshot.tickets.filter((ticket) => ticket.status === status).length, tickets: snapshot.tickets.filter((ticket) => ticket.status === status).map((ticket) => ({ id: ticket.id, stationId: ticket.stationId, defectType: snapshot.defectTypes.find((type) => type.id === ticket.defectTypeId)!, ownerRole: ticket.ownerRole, status: ticket.status, createdAt: ticket.createdAt })), provenance: "simulated", sourceLabel: "Simulated Kaizen ticket history" })),
    knowledgeProgress: cardStatuses.map((status) => ({ status, count: [...cardsById.values()].filter((card) => card.status === status).length, provenance: "simulated", sourceLabel: "Simulated knowledge-card history" })),
    seedVersion: SEED_VERSION,
    seedFingerprint,
  };
}

export async function getCameraView(): Promise<CameraView> {
  const snapshot = await getStore().getSnapshot();
  return buildCameraView(snapshot, buildShiftBoardView(snapshot));
}

export async function getLineView(): Promise<LineView> {
  const snapshot = await getStore().getSnapshot();
  return buildLineView(snapshot, buildShiftBoardView(snapshot));
}

export async function getPilotView(): Promise<PilotView> {
  return buildPilotView(await getStore().getSnapshot());
}

export async function getTrailView(alertId: string): Promise<TrailView | null> {
  return buildTrailView(await getStore().getSnapshot(), alertId);
}

export async function getSimulatorView(): Promise<SimulatorView> {
  const snapshot = await getStore().getSnapshot();
  const currentFingerprint = fingerprintSnapshot(snapshot);
  return { seedVersion: SEED_VERSION, seedFingerprint, currentFingerprint, isCanonicalReset: currentFingerprint === seedFingerprint, referenceClock: SEED_REFERENCE_CLOCK, provenance: "simulated", sourceLabel: "Deterministic canonical demo seed" };
}

export async function getOverviewView(): Promise<OverviewView> {
  const snapshot = await getStore().getSnapshot();
  const board = buildShiftBoardView(snapshot);
  const line = buildLineView(snapshot, board);
  const latestAlertId = line.flaggedBody?.alertId ?? snapshot.alerts
    .filter((alert) => isWithinRange(alert.createdAt, snapshot.currentShift.startsAt, snapshot.currentShift.endsAt))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]?.id ?? null;
  return {
    line,
    trail: latestAlertId ? buildTrailView(snapshot, latestAlertId) : null,
    ledger: [
      { id: "override-rate", label: "Operators overriding alerts", baseline: 31, target: "< 20%", baselineProvenance: "case_data", targetProvenance: "target", baselineSourceLabel: "Casebook survey", targetSourceLabel: "ES Gate 1" },
      { id: "scrap-index", label: "Scrap index (2023 = 100)", baseline: 108, target: 96, baselineProvenance: "case_data", targetProvenance: "target", baselineSourceLabel: "Casebook Exhibit 4", targetSourceLabel: "ES Table 4" },
      { id: "know-how", label: "Critical know-how documented", baseline: "33%", target: "60%", baselineProvenance: "case_data", targetProvenance: "target", baselineSourceLabel: "Casebook", targetSourceLabel: "ES Table 4" },
      { id: "ideas", label: "Improvement ideas implemented", baseline: "28%", target: "40%", baselineProvenance: "case_data", targetProvenance: "target", baselineSourceLabel: "ES Table 4", targetSourceLabel: "ES Table 4" },
    ],
  };
}
