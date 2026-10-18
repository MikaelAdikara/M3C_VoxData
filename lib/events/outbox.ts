import type { StoreSnapshot } from "@/lib/types";

/**
 * Event outbox (UNS-style envelope, ES Figure D4). Every alert, operator decision,
 * team-leader decision, Kaizen ticket and validated card is one JSON event. Events are
 * derived from the stored state, so the outbox needs no storage of its own. Actors are
 * roles plus station; no names, no images, no free-text notes.
 */
export type WorkflowEventType =
  | "alert.raised"
  | "andon.yellow"
  | "alert.rejected"
  | "decision.team_leader"
  | "ticket.opened"
  | "card.validated";

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
      data: { alert_id: a.id, body_id: a.bodyId, roi: a.roi, defect_type: a.defectTypeId, anomaly_score: a.anomalyScore, threshold: a.threshold, model_version: a.modelVersion },
    });
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
      data: { ticket_id: t.id, defect_type: t.defectTypeId, trigger_alerts: t.triggerAlertIds.length, owner_role: t.ownerRole },
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
      return `Kaizen ticket ${d.ticket_id} opened for ${d.defect_type} (${d.trigger_alerts} alerts)`;
    case "card.validated":
      return `Card ${d.card_id} r${d.revision} validated`;
  }
}
