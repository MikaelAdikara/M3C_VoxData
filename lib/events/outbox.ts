import { correctionLabel } from "@/lib/corrections/standard";
import { AUTONOMY_RULE, getAutonomyState } from "@/lib/rules/autonomy";
import { signalLabel } from "@/lib/signals/catalog";
import { detectBodyType } from "@/lib/vision/body-type";
import type { CorrectionTypeId, StoreSnapshot, WorkflowEventType } from "@/lib/types";

export type { WorkflowEventType };

/**
 * Event outbox (UNS-style envelope, ES Figure D4). Every alert, operator decision,
 * team-leader decision, Kaizen ticket and validated card is one JSON event, and so is
 * every robot error code, walk-check finding and bounded-correction step. Events are
 * derived from the stored state, so the outbox needs no storage of its own. Actors are
 * roles, rules, models or controllers; no names, no images, no free-text notes.
 */

export interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  topic: string;
  timestamp: string;
  stationId: string | null;
  actor: string;
  data: Record<string, string | number | null>;
}

const edge = (stationId: string) => `sealer-edge-${stationId.replace("st-", "")}`;

export function buildEvents(snapshot: StoreSnapshot): WorkflowEvent[] {
  const events: WorkflowEvent[] = [];
  const alertsById = new Map(snapshot.alerts.map((a) => [a.id, a]));

  for (const a of snapshot.alerts) {
    events.push({
      id: `alert.raised:${a.id}`,
      type: "alert.raised",
      topic: `spBv1.0/K2-Body/DDATA/${edge(a.stationId)}/cam-01`,
      timestamp: a.createdAt,
      stationId: a.stationId,
      actor: `model:${a.modelVersion}`,
      data: { alert_id: a.id, body_id: a.bodyId, body_type: detectBodyType(a.bodyId, a.modelVersion).id, body_type_source: "model_detection_camera", roi: a.roi, defect_type: a.defectTypeId, anomaly_score: a.anomalyScore, threshold: a.threshold, model_version: a.modelVersion },
    });
  }

  for (const s of snapshot.signals ?? []) {
    const type = s.source === "robot_error" ? "signal.robot_error" : "signal.walk_check";
    events.push({
      id: `${type}:${s.id}`,
      type,
      topic: `learning-line/K2-Body/${s.stationId}/${s.source === "robot_error" ? "robot" : "walk-check"}`,
      timestamp: s.createdAt,
      stationId: s.stationId,
      actor: s.actor,
      data: s.source === "robot_error"
        ? { signal_id: s.id, signal_source: s.source, equipment_id: s.equipmentId, error_code: s.code }
        : { signal_id: s.id, signal_source: s.source, equipment_id: s.equipmentId, symptom: s.code, photo_attached: s.photoAttached ? "yes" : "no" },
    });
  }

  for (const c of snapshot.corrections ?? []) {
    const topic = `learning-line/K2-Body/${c.stationId}/correction`;
    const base = { correction_id: c.id, correction: c.correctionType, label: correctionLabel(c.correctionType, c.stepPercent), step_percent: c.stepPercent ?? null, defect_type: c.defectTypeId, alert_id: c.alertId, ...(c.fastForward ? { fast_forward: "yes" } : {}) };
    const rule = "rule:bounded-correction";
    if (c.mode === "auto") {
      events.push({ id: `correction.auto_executed:${c.id}`, type: "correction.auto_executed", topic, timestamp: c.createdAt, stationId: c.stationId, actor: rule, data: { ...base, notify: "team_leader", executed_by: "robot_routine" } });
    } else if (c.mode === "engineer") {
      events.push({ id: `correction.escalated:${c.id}`, type: "correction.escalated", topic, timestamp: c.createdAt, stationId: c.stationId, actor: rule, data: { ...base, reason: c.escalationReason ?? null, owner_role: "role:engineer@body" } });
    } else {
      events.push({ id: `correction.proposed:${c.id}`, type: "correction.proposed", topic, timestamp: c.createdAt, stationId: c.stationId, actor: rule, data: { ...base, decides: "team_leader" } });
      if (c.decidedAt && c.decidedBy) {
        const type = c.status === "rejected" ? "correction.rejected" : "correction.approved";
        events.push({ id: `${type}:${c.id}`, type, topic, timestamp: c.decidedAt, stationId: c.stationId, actor: c.decidedBy, data: base });
      }
    }
    if (c.status === "reversed" && c.reversedAt && c.reversedBy) {
      events.push({ id: `correction.reversed:${c.id}`, type: "correction.reversed", topic, timestamp: c.reversedAt, stationId: c.stationId, actor: c.reversedBy, data: base });
    }
  }

  const autonomyKeys = new Set((snapshot.corrections ?? []).filter((c) => c.correctionType).map((c) => `${c.stationId}|${c.correctionType}`));
  for (const key of autonomyKeys) {
    const [stationId, correctionType] = key.split("|") as [string, CorrectionTypeId];
    const state = getAutonomyState(snapshot.corrections, snapshot.autonomySwitches ?? [], stationId, correctionType);
    if (!state.unlockedAt) continue;
    events.push({
      id: `autonomy.unlocked:${key}`,
      type: "autonomy.unlocked",
      topic: `learning-line/K2-Body/${stationId}/correction`,
      timestamp: state.unlockedAt,
      stationId,
      actor: "rule:earned-autonomy",
      data: { correction: correctionType, approvals: state.approvals, reversals: state.reversals, rule: `>= ${AUTONOMY_RULE.minApprovals} approvals and ${AUTONOMY_RULE.maxReversals} reversals` },
    });
  }

  for (const w of snapshot.autonomySwitches ?? []) {
    const type = w.state === "off" ? "autonomy.switched_off" : "autonomy.switched_on";
    events.push({ id: `${type}:${w.id}`, type, topic: `learning-line/K2-Body/${w.stationId}/correction`, timestamp: w.createdAt, stationId: w.stationId, actor: w.actor, data: { correction: w.correctionType, level: w.state === "off" ? "propose" : "auto_within_window" } });
  }

  for (const d of snapshot.decisions) {
    const a = alertsById.get(d.alertId);
    const stationId = a?.stationId ?? null;
    const base = { alert_id: d.alertId, body_id: a?.bodyId ?? null, roi: a?.roi ?? null, defect_type: a?.defectTypeId ?? null, decided_by: d.actor };
    if (d.kind === "confirm") {
      events.push({ id: `andon.yellow:${d.id}`, type: "andon.yellow", topic: `learning-line/K2-Body/${stationId}/andon`, timestamp: d.createdAt, stationId, actor: d.actor, data: { ...base, decision: "confirmed" } });
    } else if (d.kind === "reject") {
      events.push({ id: `alert.rejected:${d.id}`, type: "alert.rejected", topic: `learning-line/K2-Body/${stationId}/andon`, timestamp: d.createdAt, stationId, actor: d.actor, data: { ...base, decision: "rejected", reason_code: d.reasonCode ?? null } });
    } else {
      events.push({ id: `decision.team_leader:${d.id}`, type: "decision.team_leader", topic: `learning-line/K2-Body/${stationId}/decision`, timestamp: d.createdAt, stationId, actor: d.actor, data: { ...base, decision: d.kind } });
    }
  }

  for (const t of snapshot.tickets) {
    events.push({
      id: `ticket.opened:${t.id}`,
      type: "ticket.opened",
      topic: `learning-line/K2-Body/${t.stationId}/kaizen`,
      timestamp: t.createdAt,
      stationId: t.stationId,
      actor: "rule:repeat-3-per-shift",
      data: {
        ticket_id: t.id,
        signal_source: t.source ?? "bead",
        defect_type: t.defectTypeId,
        ...(t.source && t.source !== "bead" ? { subject: t.subject ?? null, trigger_signals: t.triggerSignalIds?.length ?? 0 } : { trigger_alerts: t.triggerAlertIds.length }),
        owner_role: t.ownerRole,
      },
    });
  }

  for (const c of snapshot.cards) {
    if (c.status !== "validated" || !c.validatedAt) continue;
    events.push({
      id: `card.validated:${c.id}#${c.revision}`,
      type: "card.validated",
      topic: "learning-line/K2-Body/knowledge",
      timestamp: c.validatedAt,
      stationId: c.stationIds[0] ?? null,
      actor: c.validatedByRole ?? "role:senior_expert@body",
      data: { card_id: c.id, revision: c.revision, factor_4m: c.factor4M, source_ticket: c.sourceTicketId ?? null },
    });
  }

  return events.sort((x, y) => Date.parse(y.timestamp) - Date.parse(x.timestamp) || x.id.localeCompare(y.id));
}

/** Events present after a change that were not there before. */
export function newEvents(before: StoreSnapshot, after: StoreSnapshot): WorkflowEvent[] {
  const seen = new Set(buildEvents(before).map((e) => e.id));
  return buildEvents(after).filter((e) => !seen.has(e.id)).reverse();
}

export function summarizeEvent(e: WorkflowEvent): string {
  const d = e.data;
  switch (e.type) {
    case "alert.raised":
      return `${d.defect_type ?? "Anomaly"} on ${d.roi}, score ${d.anomaly_score} vs ${d.threshold}`;
    case "andon.yellow":
      return `Operator confirmed ${d.defect_type ?? "the alert"} on ${d.roi}: yellow andon`;
    case "alert.rejected":
      return `Operator rejected the alert on ${d.roi}, reason ${d.reason_code ?? "none"}`;
    case "decision.team_leader":
      return `Team leader decided ${String(d.decision).replace("_", " and ")}`;
    case "ticket.opened":
      return d.signal_source && d.signal_source !== "bead"
        ? `Kaizen ticket ${d.ticket_id} opened: ${d.subject} (${d.trigger_signals} repeats)`
        : `Kaizen ticket ${d.ticket_id} opened for ${d.defect_type} (${d.trigger_alerts} alerts)`;
    case "card.validated":
      return `Card ${d.card_id} r${d.revision} validated`;
    case "signal.robot_error":
      return `Robot controller ${d.equipment_id}: minor error ${signalLabel({ source: "robot_error", code: String(d.error_code) })}`;
    case "signal.walk_check":
      return `Walk-check on ${d.equipment_id}: ${signalLabel({ source: "walk_check", code: String(d.symptom) }).toLowerCase()}${d.photo_attached === "yes" ? ", photo attached" : ""}`;
    case "correction.proposed":
      return `Correction proposed: ${d.label}; team leader decides${d.fast_forward ? " (fast-forward)" : ""}`;
    case "correction.approved":
      return `Team leader approved ${d.label}; the robot's own routine runs it${d.fast_forward ? " (fast-forward)" : ""}`;
    case "correction.rejected":
      return `Team leader rejected ${d.label}`;
    case "correction.auto_executed":
      return `Auto within window: ${d.label}; team leader notified`;
    case "correction.escalated":
      return d.reason === "outside_window" ? `${d.label} is outside the window: sent to the engineer` : `No standardized correction for ${d.defect_type}: sent to the engineer`;
    case "correction.reversed":
      return `Team leader reversed ${d.label}`;
    case "autonomy.unlocked":
      return `Auto within window unlocked for ${d.correction} (${d.approvals} approvals, ${d.reversals} reversals)`;
    case "autonomy.switched_off":
      return `Team leader switched auto off for ${d.correction}`;
    case "autonomy.switched_on":
      return `Team leader switched auto back on for ${d.correction}`;
  }
}
