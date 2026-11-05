import { signalLabel } from "@/lib/signals/catalog";
import { stepLabel } from "@/lib/standard-steps/catalog";
import { detectBodyType } from "@/lib/vision/body-type";
import type { StoreSnapshot, WorkflowEventType } from "@/lib/types";

export type { WorkflowEventType };

/**
 * Event outbox (UNS-style envelope, ES Figure D4). Every alert, operator decision,
 * team-leader decision, Kaizen ticket and validated card is one JSON event, and so is
 * every robot error code, walk-check finding, work order and standard step. Events are
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

const TICKET_RULE = {
  bead: "rule:repeat-3-per-shift",
  robot_error: "rule:weekly-pareto-rise",
  walk_check: "rule:finding-back-after-work-order",
} as const;

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

  for (const w of snapshot.workOrders ?? []) {
    const topic = `learning-line/K2-Body/${w.stationId}/work-order`;
    const base = { work_order_id: w.id, equipment_id: w.equipmentId, symptom: w.symptom, returned_after: w.returnOf ?? null };
    events.push({ id: `work_order.opened:${w.id}`, type: "work_order.opened", topic, timestamp: w.openedAt, stationId: w.stationId, actor: "rule:walk-check-finding", data: base });
    if (w.status === "closed" && w.closedAt) {
      events.push({ id: `work_order.closed:${w.id}`, type: "work_order.closed", topic, timestamp: w.closedAt, stationId: w.stationId, actor: w.closedBy ?? "role:maintenance@body", data: base });
    }
  }

  for (const st of snapshot.standardSteps ?? []) {
    const topic = `learning-line/K2-Body/${st.stationId}/standard-step`;
    const base = {
      step_id: st.id,
      step: st.stepType,
      label: stepLabel(st),
      in_standard: st.inStandard ? "yes" : "no",
      source_card: st.sourceCardId,
      defect_type: st.defectTypeId,
      alert_id: st.alertId,
      ticket_id: st.ticketId,
    };
    events.push({ id: `step.shown:${st.id}`, type: "step.shown", topic, timestamp: st.createdAt, stationId: st.stationId, actor: "rule:standard-step", data: { ...base, next: st.inStandard ? "team_leader" : "ask_engineer" } });
    if (st.status !== "shown" && st.recordedAt && st.recordedBy) {
      const type = st.status === "done" ? "step.done" : "step.not_done";
      events.push({ id: `${type}:${st.id}`, type, topic, timestamp: st.recordedAt, stationId: st.stationId, actor: st.recordedBy, data: { ...base, ...(st.status === "not_done" ? { reason_code: st.notDoneReason ?? null } : { done_on: "robot_panel" }) } });
    }
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
      actor: TICKET_RULE[t.source ?? "bead"],
      data: {
        ticket_id: t.id,
        signal_source: t.source ?? "bead",
        defect_type: t.defectTypeId,
        ...(t.source && t.source !== "bead"
          ? { subject: t.subject ?? null, trigger_signals: t.triggerSignalIds?.length ?? 0, ...(t.returnedAfterWorkOrderId ? { returned_after: t.returnedAfterWorkOrderId } : {}) }
          : { trigger_alerts: t.triggerAlertIds.length }),
        owner_role: t.ownerRole,
      },
    });
    for (const alertId of t.repeatAlertIds ?? []) {
      const a = alertsById.get(alertId);
      if (!a) continue;
      const confirmedAt = snapshot.decisions.find((d) => d.alertId === alertId && d.kind === "confirm")?.createdAt ?? a.createdAt;
      events.push({
        id: `ticket.repeat_logged:${t.id}:${alertId}`,
        type: "ticket.repeat_logged",
        topic: `learning-line/K2-Body/${t.stationId}/kaizen`,
        timestamp: confirmedAt,
        stationId: t.stationId,
        actor: "rule:repeat-on-open-ticket",
        data: { ticket_id: t.id, alert_id: alertId, body_id: a.bodyId, defect_type: a.defectTypeId, repeats_logged: (t.repeatAlertIds ?? []).indexOf(alertId) + 1 },
      });
    }
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
      if (d.signal_source === "robot_error") return `Kaizen ticket ${d.ticket_id} opened: ${d.subject} rose in the weekly Pareto; owner maintenance`;
      if (d.signal_source === "walk_check") return `Kaizen ticket ${d.ticket_id} opened: ${d.subject} came back after ${d.returned_after ?? "its work order"} closed; owner maintenance`;
      return `Kaizen ticket ${d.ticket_id} opened for ${d.defect_type} (${d.trigger_alerts} alerts)`;
    case "ticket.repeat_logged":
      return `Repeat of ${d.defect_type} on body ${d.body_id} logged on open ticket ${d.ticket_id}`;
    case "card.validated":
      return `Card ${d.card_id} r${d.revision} validated`;
    case "signal.robot_error":
      return `Robot controller ${d.equipment_id}: minor error ${signalLabel({ source: "robot_error", code: String(d.error_code) })}`;
    case "signal.walk_check":
      return `Walk-check on ${d.equipment_id}: ${signalLabel({ source: "walk_check", code: String(d.symptom) }).toLowerCase()}${d.photo_attached === "yes" ? ", photo attached" : ""}`;
    case "work_order.opened":
      return d.returned_after
        ? `Work order ${d.work_order_id} opened: ${walkLabel(d.symptom)} on ${d.equipment_id} is back after ${d.returned_after}`
        : `Work order ${d.work_order_id} opened for ${walkLabel(d.symptom)} on ${d.equipment_id}`;
    case "work_order.closed":
      return `Maintenance closed work order ${d.work_order_id}`;
    case "step.shown":
      return d.in_standard === "yes"
        ? `Standard step shown: ${d.label} (card ${d.source_card}); team leader runs it on the robot panel`
        : `${d.label} is not in the standard: ask the engineer`;
    case "step.done":
      return `Team leader: ${d.label} done on the robot panel (card ${d.source_card})`;
    case "step.not_done":
      return `Team leader: ${d.label} not done, reason ${d.reason_code ?? "none"}`;
  }
}

const walkLabel = (code: string | number | null) => signalLabel({ source: "walk_check", code: String(code) }).toLowerCase();
