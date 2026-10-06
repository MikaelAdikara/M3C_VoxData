import { cookies } from "next/headers";

import { DEFAULT_ROLE, isRole, ROLE_COOKIE_NAME } from "@/lib/role-cookie";
import { getFalseAlarmBudgetState } from "@/lib/rules/budget";
import { calculateOverrideRate } from "@/lib/rules/metrics";
import { getShiftRecommendation } from "@/lib/rules/recommend";
import { getConfirmedRepeatState, isConfirmedAlert } from "@/lib/rules/repeat";
import { getStore } from "@/lib/store";
import type {
  Alert,
  AlertView,
  DefectType,
  ReasonCodeOption,
  RecommendationView,
  Role,
  ShiftBoardView,
  StationView,
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

  return {
    station,
    openAlert: openAlert ? toAlertView(openAlert, defectTypesById) : null,
    reasonCodes,
    ideasOpen: snapshot.ideas.filter(
      (idea) => idea.stationId === stationId && idea.status === "submitted",
    ).length,
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
  };
}
