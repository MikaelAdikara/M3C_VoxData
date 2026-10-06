import { getStore } from "@/lib/store";
import type {
  Alert,
  AlertView,
  DefectType,
  ReasonCodeOption,
  ShiftBoardView,
  StationView,
} from "@/lib/types";

export const FALSE_ALARM_BUDGET = 2;

export const reasonCodes: ReasonCodeOption[] = [
  { value: "reflection", label: "Reflection" },
  { value: "variant_mismatch", label: "Variant mismatch" },
  { value: "dirty_lens", label: "Dirty lens" },
  { value: "within_tolerance", label: "Bead within tolerance" },
  { value: "other", label: "Other" },
];

function toAlertView(alert: Alert, defectTypes: Map<string, DefectType>): AlertView {
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
  };
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
      const confirmedCount = stationAlerts.filter((alert) => alert.status === "confirmed").length;
      const rejectedCount = stationAlerts.filter((alert) => alert.status === "rejected").length;
      const decidedCount = confirmedCount + rejectedCount;

      return {
        station,
        openAlerts: stationAlerts.filter((alert) => alert.status === "open").length,
        confirmedCount,
        rejectedCount,
        falseAlarmBudget: FALSE_ALARM_BUDGET,
        modelReviewNeeded: rejectedCount > FALSE_ALARM_BUDGET,
        overrideRate: decidedCount === 0 ? 0 : rejectedCount / decidedCount,
      };
    }),
    pendingDecisions: shiftAlerts
      .filter((alert) => alert.status === "confirmed")
      .map((alert) => toAlertView(alert, defectTypesById)),
  };
}
