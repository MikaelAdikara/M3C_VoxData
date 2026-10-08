import { pilotScenarios, externalPilotClasses, curatedVisualReferences } from "@/lib/pilot-scenarios";
import { calculateOverrideRate, calculateOverrideRateForAlerts } from "@/lib/rules/metrics";
import { simulatedNow } from "@/lib/simulation-clock";
import type { Alert, AlertView, CameraEventView, CameraView, LineStationView, LineView, PilotView, ShiftBoardView, StoreSnapshot, TrailView } from "@/lib/types";

const SIMULATED_SOURCE = "Simulated K2-Body demo state";

function inShift(at: string, snapshot: StoreSnapshot): boolean {
  const time = Date.parse(at);
  return time >= Date.parse(snapshot.currentShift.startsAt) && time <= Date.parse(snapshot.currentShift.endsAt);
}

function alertView(alert: Alert, snapshot: StoreSnapshot): AlertView {
  return {
    ...alert,
    defectType: snapshot.defectTypes.find((item) => item.id === alert.defectTypeId) ?? null,
    recommendation: null,
  };
}

export function buildCameraView(snapshot: StoreSnapshot, board: ShiftBoardView): CameraView {
  const cameraByStation = new Map(snapshot.cameras.map((camera) => [camera.stationId, camera]));
  const events: CameraEventView[] = [];
  for (const alert of snapshot.alerts) {
    if (!inShift(alert.createdAt, snapshot)) continue;
    const camera = cameraByStation.get(alert.stationId);
    if (!camera || camera.kind === "paint_tablet") continue;
    events.push({ cameraId: camera.id, at: alert.createdAt, kind: "alert", alertId: alert.id, defectTypeId: alert.defectTypeId, visualScenarioId: alert.visualScenarioId, label: `Alert · ${snapshot.defectTypes.find((type) => type.id === alert.defectTypeId)?.name ?? "Anomaly"}` });
  }
  for (const decision of snapshot.decisions) {
    if (!inShift(decision.createdAt, snapshot)) continue;
    const alert = snapshot.alerts.find((item) => item.id === decision.alertId);
    const camera = alert && cameraByStation.get(alert.stationId);
    if (!camera || camera.kind === "paint_tablet") continue;
    events.push({ cameraId: camera.id, at: decision.createdAt, kind: decision.kind, alertId: decision.alertId, label: decision.kind === "reject" ? `Rejected: ${decision.reasonCode ?? "unspecified"}` : decision.kind === "confirm" ? "Confirmed by operator" : `Team leader: ${decision.kind.replace("_", " ")}` });
  }
  for (const gap of snapshot.recordingGaps) {
    const shiftStart = Date.parse(snapshot.currentShift.startsAt);
    const shiftEnd = Date.parse(snapshot.currentShift.endsAt);
    if (Date.parse(gap.startsAt) > shiftEnd || (gap.endsAt && Date.parse(gap.endsAt) < shiftStart)) continue;
    events.push({ cameraId: gap.cameraId, at: new Date(Math.max(shiftStart, Date.parse(gap.startsAt))).toISOString(), endsAt: gap.endsAt, kind: "gap", label: `Recording gap · ${gap.reason}` });
  }
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.cameraId.localeCompare(b.cameraId));

  const cameras = snapshot.cameras.map((camera) => {
    const tile = board.stations.find((item) => item.station.id === camera.stationId);
    const ticket = snapshot.cameraMaintenanceTickets.find((item) => item.cameraId === camera.id && item.status === "open");
    const publicClip = ["st-03", "st-05", "final-01"].includes(camera.stationId);
    return {
      ...camera,
      openAlertIds: snapshot.alerts.filter((alert) => alert.stationId === camera.stationId && alert.status === "open").map((alert) => alert.id),
      pendingDecisionAlertIds: board.pendingDecisions.filter((alert) => alert.stationId === camera.stationId).map((alert) => alert.id),
      modelReviewNeeded: tile?.modelReviewNeeded ?? false,
      modelReview: board.modelReviews.find((review) => review.stationId === camera.stationId) ?? null,
      maintenanceTicketId: ticket?.id ?? null,
      media: camera.kind === "paint_tablet" ? null : publicClip
        ? { assetId: `industrial-context-${camera.stationId}`, sourceType: "public_reference" as const, provenance: "illustration" as const, sourceLabel: "Public industrial reference · not TMMIN footage · no annotation" }
        : { assetId: `procedural-cell-${camera.stationId}`, sourceType: "generated_simulation" as const, provenance: "illustration" as const, sourceLabel: "Generated prototype scene · simulated" },
    };
  });
  return { shift: snapshot.currentShift, asOf: simulatedNow(snapshot), cameras, events, maintenanceTickets: snapshot.cameraMaintenanceTickets, provenance: "simulated", sourceLabel: SIMULATED_SOURCE };
}

export function buildLineView(snapshot: StoreSnapshot, board: ShiftBoardView): LineView {
  const decisions = snapshot.decisions.filter((item) => inShift(item.createdAt, snapshot) && ["stop_fix", "contain", "continue"].includes(item.kind));
  const stations = board.stations.map((tile) => {
    const pendingDecision = board.pendingDecisions.find((item) => item.stationId === tile.station.id) ?? null;
    const last = decisions.filter((decision) => snapshot.alerts.some((alert) => alert.id === decision.alertId && alert.stationId === tile.station.id)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    const isStoppedHere = snapshot.lineOperation.state === "stopped" && last?.id === snapshot.lineOperation.stoppedByDecisionId;
    const state: LineStationView["state"] = isStoppedHere ? "stopped" : pendingDecision ? "yellow_andon" : tile.modelReviewNeeded ? "model_review" : last?.kind === "contain" ? "contained" : "running";
    return { ...tile, state, pendingDecision, lastDecision: last ? { kind: last.kind, actor: last.actor, note: last.note, createdAt: last.createdAt } : null };
  });
  const confirmed = stations.reduce((sum, item) => sum + item.confirmedCount, 0);
  const rejected = stations.reduce((sum, item) => sum + item.rejectedCount, 0);
  const open = stations.reduce((sum, item) => sum + item.openAlerts, 0);
  const selectedAlert = snapshot.lineOperation.state === "stopped"
    ? snapshot.alerts.find((alert) => alert.bodyId === snapshot.lineOperation.heldBodyId)
    : board.pendingDecisions[0] && snapshot.alerts.find((alert) => alert.id === board.pendingDecisions[0].id);
  const flaggedBody = selectedAlert ? {
    bodyId: selectedAlert.bodyId,
    detectedAtStationId: selectedAlert.stationId,
    currentLocationStationId: null,
    state: snapshot.lineOperation.state === "stopped" ? "held_for_repair" as const : "awaiting_team_leader" as const,
    alertId: selectedAlert.id,
  } : null;
  return {
    shift: snapshot.currentShift,
    stations,
    line: snapshot.lineOperation,
    taktMinutes: 1.5,
    taktProvenance: "benchmark",
    taktSourceLabel: "ES Section 2.2 · Karawang takt range 1.5–1.57 min",
    bodiesTargetApprox: 300,
    bodiesTargetProvenance: "benchmark",
    bodiesTargetSourceLabel: "ES Appendix D · approximate shift assumption",
    productionProvenance: "simulated",
    productionSourceLabel: "Simulated production counter",
    totals: { open, confirmed, rejected, overrideRate: calculateOverrideRate(confirmed, rejected), provenance: "simulated", sourceLabel: "Simulated current shift" },
    flaggedBody,
    pendingDecisions: board.pendingDecisions,
    provenance: "simulated",
    sourceLabel: SIMULATED_SOURCE,
  };
}

export function buildTrailView(snapshot: StoreSnapshot, alertId: string): TrailView | null {
  const alert = snapshot.alerts.find((item) => item.id === alertId);
  if (!alert) return null;
  const steps: TrailView["steps"] = [{ kind: "flagged", at: alert.createdAt, actor: "system", label: "Flagged by camera", refId: alert.id }];
  const decisions = snapshot.decisions.filter((item) => item.alertId === alert.id).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  for (const decision of decisions) {
    steps.push({ kind: decision.kind === "confirm" ? "confirmed" : decision.kind === "reject" ? "rejected" : "team_leader_decision", at: decision.createdAt, actor: decision.actor, label: decision.kind.replace("_", " "), refId: decision.id });
  }
  const ticket = snapshot.tickets.find((item) => item.triggerAlertIds.includes(alert.id));
  if (ticket) steps.push({ kind: "a3_open", at: ticket.createdAt, actor: "system", label: "Kaizen A3 opened", refId: ticket.id });
  const card = ticket && snapshot.cards.filter((item) => item.sourceTicketId === ticket.id && item.status === "validated").sort((a, b) => b.revision - a.revision)[0];
  if (card?.validatedAt) steps.push({ kind: "validated_standard", at: card.validatedAt, actor: card.validatedByRole ?? "role:senior_expert@body", label: "Knowledge card validated", refId: `${card.id} r${card.revision}` });
  steps.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.kind.localeCompare(b.kind));
  return { alert: alertView(alert, snapshot), steps, ticketId: ticket?.id ?? null, cardId: card?.id ?? null, provenance: "simulated", sourceLabel: SIMULATED_SOURCE };
}

export function buildPilotView(snapshot: StoreSnapshot): PilotView {
  const byDate = new Map<string, Alert[]>();
  for (const alert of snapshot.alerts) {
    if (!alert.id.startsWith("alert-history-")) continue;
    const date = alert.createdAt.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), alert]);
  }
  const dates = [...byDate.keys()].sort();
  const dailyOverride = dates.map((date, index) => {
    const alerts = byDate.get(date)!;
    const sevenDayAlerts = dates.slice(Math.max(0, index - 6), index + 1).flatMap((day) => byDate.get(day)!);
    return { date, percent: Math.round(calculateOverrideRateForAlerts(alerts, snapshot.decisions) * 1_000) / 10, sevenDayAveragePercent: Math.round(calculateOverrideRateForAlerts(sevenDayAlerts, snapshot.decisions) * 1_000) / 10, sampleSize: alerts.length, provenance: "simulated" as const, sourceLabel: "Simulated 30-day history" };
  });
  const weeklyOverride = Array.from({ length: Math.ceil(dates.length / 7) }, (_, week) => {
    const alerts = dates.slice(week * 7, (week + 1) * 7).flatMap((date) => byDate.get(date)!);
    return { week: week + 1, percent: Math.round(calculateOverrideRateForAlerts(alerts, snapshot.decisions) * 1_000) / 10, sampleSize: alerts.length, provenance: "simulated" as const, sourceLabel: "Simulated 30-day history" };
  });
  return { dailyOverride, weeklyOverride, baselinePercent: 31, currentPercent: Math.round(dailyOverride.at(-1)?.percent ?? 0), gate1TargetPercent: 20, baselineSourceLabel: "Casebook survey", baselineProvenance: "case_data", gate1TargetSourceLabel: "ES Gate 1", gate1TargetProvenance: "target", scenarios: structuredClone(pilotScenarios), visualReferences: curatedVisualReferences.map((reference) => ({ visualClass: reference.visualClass, media: { assetId: reference.assetId, sourceType: "public_reference", provenance: "illustration", sourceLabel: `Roboflow Universe ${reference.externalClass} class, CC BY 4.0 · visual reference only`, externalClass: reference.externalClass } })), externalClasses: [...externalPilotClasses], provenance: "simulated", sourceLabel: "Simulated 30-day history" };
}
