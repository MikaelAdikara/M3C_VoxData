import { createHmac } from "node:crypto";

import { summarizeEvent, type WorkflowEvent } from "@/lib/events/outbox";
import type { WorkflowEventType } from "@/lib/types";

/**
 * Optional delivery of outbox events to a workflow tool (n8n, Make, …). Only when
 * WORKFLOW_WEBHOOK_URL is set; the demo works the same without it. Delivery never
 * blocks or fails a shop-floor action: errors are recorded and dropped.
 * With WORKFLOW_WEBHOOK_SECRET set, the body is signed (X-Learning-Line-Signature: sha256=<hex HMAC>).
 *
 * WORKFLOW_WEBHOOK_FORMAT=chat (off by default) posts escalations only, one chat message
 * each, as {"text": "..."}: the body a Teams or Slack incoming webhook accepts.
 */
export interface DeliveryStatus {
  at: string;
  events: number;
  ok: boolean;
  status: number | null;
  error: string | null;
}

export type WebhookFormat = "events" | "chat";

const state = globalThis as typeof globalThis & { learningLineLastDelivery?: DeliveryStatus };

export function webhookUrl(): URL | null {
  const raw = process.env.WORKFLOW_WEBHOOK_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function webhookFormat(): WebhookFormat {
  return process.env.WORKFLOW_WEBHOOK_FORMAT?.trim().toLowerCase() === "chat" ? "chat" : "events";
}

/** Events that ask a person to act, or tell the team leader something ran on its own. */
export const CHAT_ESCALATION_TYPES: readonly WorkflowEventType[] = [
  "andon.yellow",
  "ticket.opened",
  "correction.proposed",
  "correction.auto_executed",
  "correction.escalated",
  "autonomy.switched_off",
];

const WHO: Partial<Record<WorkflowEventType, string>> = {
  "andon.yellow": "Team leader: decide stop and fix, contain or continue.",
  "ticket.opened": "Owner engineer: start the A3.",
  "correction.proposed": "Team leader: approve or reject on the shift board.",
  "correction.auto_executed": "Team leader: logged for you; reverse it or switch auto off on the shift board.",
  "correction.escalated": "Engineer: outside what the standardized work allows.",
  "autonomy.switched_off": "Corrections of this type go back to the team leader.",
};

const chatTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** One chat message (Teams/Slack incoming-webhook body) for an escalation; null for other events. */
export function chatMessage(event: WorkflowEvent, options: { test?: boolean } = {}): { text: string } | null {
  if (!CHAT_ESCALATION_TYPES.includes(event.type)) return null;
  const where = event.stationId ?? "plant";
  const when = chatTime.format(new Date(event.timestamp));
  const lines = [
    `${options.test ? "[TEST] " : ""}Learning Line (simulated) · ${where} · ${when} WIB`,
    summarizeEvent(event),
    WHO[event.type] ?? "",
    `Event ${event.id}`,
  ].filter(Boolean);
  return { text: lines.join("\n") };
}

/** Last delivery seen by this server instance (serverless instances do not share it). */
export function lastDelivery(): DeliveryStatus | null {
  return state.learningLineLastDelivery ?? null;
}

function headersFor(body: string, count: number): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json", "x-learning-line-events": String(count) };
  const secret = process.env.WORKFLOW_WEBHOOK_SECRET;
  if (secret) headers["x-learning-line-signature"] = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return headers;
}

/** Bodies to post: one envelope with every event, or one chat message per escalation. */
export function webhookBodies(events: readonly WorkflowEvent[], format: WebhookFormat, options: { test?: boolean } = {}): { body: string; count: number }[] {
  if (format === "chat") {
    return events
      .map((event) => chatMessage(event, options))
      .filter((message): message is { text: string } => message !== null)
      .map((message) => ({ body: JSON.stringify(message), count: 1 }));
  }
  return [{ body: JSON.stringify({ source: "learning-line-prototype", test: Boolean(options.test), events }), count: events.length }];
}

export async function postEvents(events: readonly WorkflowEvent[], options: { test?: boolean } = {}): Promise<DeliveryStatus | null> {
  const url = webhookUrl();
  if (!url || events.length === 0) return null;
  const bodies = webhookBodies(events, webhookFormat(), options);
  if (bodies.length === 0) return null;
  let result: DeliveryStatus = { at: new Date().toISOString(), events: 0, ok: true, status: null, error: null };
  for (const { body, count } of bodies) {
    try {
      const res = await fetch(url, { method: "POST", headers: headersFor(body, count), body, signal: AbortSignal.timeout(2_500) });
      result = { at: new Date().toISOString(), events: result.events + count, ok: result.ok && res.ok, status: res.status, error: res.ok ? result.error : `HTTP ${res.status}` };
    } catch (error) {
      result = { at: new Date().toISOString(), events: result.events + count, ok: false, status: null, error: error instanceof Error ? error.name : "error" };
    }
  }
  state.learningLineLastDelivery = result;
  return result;
}
