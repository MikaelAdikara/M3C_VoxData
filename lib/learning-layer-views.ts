import { correctionLabel, CORRECTION_SPECS, correctionSpec, stationStandard } from "@/lib/corrections/standard";
import { AUTONOMY_RULE, getAutonomyState, netPressureStep, type AutonomyState } from "@/lib/rules/autonomy";
import { isConfirmedAlert, isWithinShift, REPEAT_TICKET_THRESHOLD } from "@/lib/rules/repeat";
import { signalRepeatKey } from "@/lib/rules/signals";
import {
  EQUIPMENT,
  equipmentById,
  ROBOT_CODES,
  signalLabel,
  signalSubject,
  WALK_CHECK_SYMPTOMS,
  type Equipment,
} from "@/lib/signals/catalog";
import type {
  Actor,
  Correction,
  CorrectionStatus,
  CorrectionTypeId,
  LineSignal,
  Shift,
  SignalSource,
  SignalView,
  StoreSnapshot,
  WalkCheckSymptom,
} from "@/lib/types";

const DAY_MS = 86_400_000;

export function toSignalView(signal: LineSignal): SignalView {
  return {
    id: signal.id,
    source: signal.source,
    stationId: signal.stationId,
    equipmentId: signal.equipmentId,
    equipmentName: equipmentById(signal.equipmentId)?.name ?? signal.equipmentId,
    code: signal.code,
    label: signalLabel(signal),
    photoAttached: Boolean(signal.photoAttached),
    actor: signal.actor,
    createdAt: signal.createdAt,
  };
}

export interface RepeatCounterView {
  key: string;
  source: SignalSource;
  stationId: string;
  subject: string;
  count: number;
  threshold: number;
  ticketId: string | null;
}

export interface SignalsView {
  shift: Shift;
  threshold: number;
  counters: RepeatCounterView[];
  recent: SignalView[];
  robotPareto: { code: string; label: string; count: number }[];
  equipment: Equipment[];
  symptoms: { value: WalkCheckSymptom; label: string }[];
  provenance: "simulated";
  sourceLabel: string;
}

/** /signals: the three repeat sources side by side, with this shift's counters against the one rule. */
export function buildSignalsView(snapshot: StoreSnapshot): SignalsView {
  const shift = snapshot.currentShift;
  const defectNames = new Map(snapshot.defectTypes.map((d) => [d.id, d.name]));
  const counters = new Map<string, RepeatCounterView>();

  for (const alert of snapshot.alerts) {
    if (!alert.defectTypeId || !isWithinShift(alert.createdAt, shift) || !isConfirmedAlert(alert, snapshot.decisions)) continue;
    const key = `bead:${alert.stationId}:${alert.defectTypeId}`;
    const existing = counters.get(key);
    if (existing) existing.count += 1;
    else {
      const ticket = snapshot.tickets.find((t) => t.stationId === alert.stationId && t.defectTypeId === alert.defectTypeId && t.status !== "closed");
      counters.set(key, { key, source: "bead", stationId: alert.stationId, subject: defectNames.get(alert.defectTypeId) ?? alert.defectTypeId, count: 1, threshold: REPEAT_TICKET_THRESHOLD, ticketId: ticket?.id ?? null });
    }
  }
  for (const signal of snapshot.signals) {
    if (!isWithinShift(signal.createdAt, shift)) continue;
    const key = signalRepeatKey(signal);
    const existing = counters.get(key);
    if (existing) existing.count += 1;
    else {
      const ticket = snapshot.tickets.find((t) => t.signalKey === key && t.status !== "closed");
      counters.set(key, { key, source: signal.source, stationId: signal.stationId, subject: signalSubject(signal), count: 1, threshold: REPEAT_TICKET_THRESHOLD, ticketId: ticket?.id ?? null });
    }
  }

  const weekStart = Date.parse(shift.endsAt) - 7 * DAY_MS;
  const robotCounts = new Map<string, number>();
  for (const signal of snapshot.signals) {
    if (signal.source !== "robot_error" || Date.parse(signal.createdAt) < weekStart) continue;
    robotCounts.set(signal.code, (robotCounts.get(signal.code) ?? 0) + 1);
  }

  return {
    shift,
    threshold: REPEAT_TICKET_THRESHOLD,
    counters: [...counters.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    recent: [...snapshot.signals].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12).map(toSignalView),
    robotPareto: [...robotCounts.entries()]
      .map(([code, count]) => ({ code, label: ROBOT_CODES.find((c) => c.code === code)?.label ?? code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    equipment: EQUIPMENT,
    symptoms: WALK_CHECK_SYMPTOMS,
    provenance: "simulated",
    sourceLabel: "Simulated controller codes and walk-check findings",
  };
}

export interface CorrectionItemView {
  id: string;
  stationId: string;
  label: string;
  correctionType: CorrectionTypeId | null;
  stepPercent: number | null;
  mode: Correction["mode"];
  status: CorrectionStatus;
  escalationReason: Correction["escalationReason"] | null;
  defectName: string | null;
  bodyId: string | null;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: Actor | null;
  reversedAt: string | null;
  canReverse: boolean;
}

export interface AutonomyLadderView extends AutonomyState {
  label: string;
  windowPercent: number | null;
  stepPercent: number | null;
  netPercent: number | null;
}

export interface CorrectionsView {
  rule: typeof AUTONOMY_RULE;
  standard: { reference: string; corrections: { type: CorrectionTypeId; label: string; answers: string; window: string | null }[] };
  pending: CorrectionItemView[];
  recent: CorrectionItemView[];
  ladders: AutonomyLadderView[];
  provenance: "simulated";
  sourceLabel: string;
}

const DEMO_STATION = "st-04";

/** Shift board: bounded corrections, team-leader decisions and the earned-autonomy ladder. */
export function buildCorrectionsView(snapshot: StoreSnapshot): CorrectionsView {
  const shift = snapshot.currentShift;
  const defectNames = new Map(snapshot.defectTypes.map((d) => [d.id, d.name]));
  const alerts = new Map(snapshot.alerts.map((a) => [a.id, a]));
  const toItem = (c: Correction): CorrectionItemView => ({
    id: c.id,
    stationId: c.stationId,
    label: correctionLabel(c.correctionType, c.stepPercent),
    correctionType: c.correctionType,
    stepPercent: c.stepPercent ?? null,
    mode: c.mode,
    status: c.status,
    escalationReason: c.escalationReason ?? null,
    defectName: c.defectTypeId ? (defectNames.get(c.defectTypeId) ?? null) : null,
    bodyId: c.alertId ? (alerts.get(c.alertId)?.bodyId ?? null) : null,
    createdAt: c.createdAt,
    decidedAt: c.decidedAt ?? null,
    decidedBy: c.decidedBy ?? null,
    reversedAt: c.reversedAt ?? null,
    canReverse: (c.status === "approved" || c.status === "auto_executed") && isWithinShift(c.decidedAt ?? c.createdAt, shift),
  });

  const keys = new Set<string>(CORRECTION_SPECS.map((spec) => `${DEMO_STATION}|${spec.type}`));
  for (const c of snapshot.corrections) if (c.correctionType) keys.add(`${c.stationId}|${c.correctionType}`);
  const ladders = [...keys].sort().map((key): AutonomyLadderView => {
    const [stationId, type] = key.split("|") as [string, CorrectionTypeId];
    const spec = correctionSpec(type);
    return {
      ...getAutonomyState(snapshot.corrections, snapshot.autonomySwitches, stationId, type),
      label: spec.label,
      windowPercent: spec.windowPercent ?? null,
      stepPercent: spec.stepPercent ?? null,
      netPercent: spec.windowPercent !== undefined ? netPressureStep(snapshot.corrections, stationId, shift) : null,
    };
  });

  const standard = stationStandard(DEMO_STATION)!;
  const byNewest = (a: Correction, b: Correction) =>
    Date.parse(b.reversedAt ?? b.decidedAt ?? b.createdAt) - Date.parse(a.reversedAt ?? a.decidedAt ?? a.createdAt);
  return {
    rule: AUTONOMY_RULE,
    standard: {
      reference: standard.reference,
      corrections: standard.corrections.map((spec) => ({
        type: spec.type,
        label: spec.label,
        answers: Object.keys(spec.answers).map((id) => defectNames.get(id as never) ?? id).join(", ").toLowerCase(),
        window: spec.windowPercent !== undefined ? `${spec.stepPercent}% per step, within ±${spec.windowPercent}% of the standard setpoint per shift` : null,
      })),
    },
    pending: snapshot.corrections.filter((c) => c.status === "proposed").sort(byNewest).map(toItem),
    // Past simulated approvals from the fast-forward stay out of the log; anything decided this shift shows.
    recent: snapshot.corrections
      .filter((c) => c.status !== "proposed" && !(c.fastForward && !isWithinShift(c.decidedAt ?? c.createdAt, shift)))
      .sort(byNewest)
      .slice(0, 8)
      .map(toItem),
    ladders,
    provenance: "simulated",
    sourceLabel: "Simulated standardized-work corrections",
  };
}
