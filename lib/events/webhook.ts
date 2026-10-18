import { createHmac } from "node:crypto";

import type { WorkflowEvent } from "@/lib/events/outbox";

/**
 * Optional delivery of outbox events to a workflow tool (n8n, Make, …). Only when
 * WORKFLOW_WEBHOOK_URL is set; the demo works the same without it. Delivery never
 * blocks or fails a shop-floor action: errors are recorded and dropped.
 * With WORKFLOW_WEBHOOK_SECRET set, the body is signed (X-Learning-Line-Signature: sha256=<hex HMAC>).
 */
export interface DeliveryStatus {
  at: string;
  events: number;
  ok: boolean;
  status: number | null;
  error: string | null;
}

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

/** Last delivery seen by this server instance (serverless instances do not share it). */
export function lastDelivery(): DeliveryStatus | null {
  return state.learningLineLastDelivery ?? null;
}

export async function postEvents(events: readonly WorkflowEvent[], options: { test?: boolean } = {}): Promise<DeliveryStatus | null> {
  const url = webhookUrl();
  if (!url || events.length === 0) return null;
  const body = JSON.stringify({ source: "learning-line-prototype", test: Boolean(options.test), events });
  const headers: Record<string, string> = { "content-type": "application/json", "x-learning-line-events": String(events.length) };
  const secret = process.env.WORKFLOW_WEBHOOK_SECRET;
  if (secret) headers["x-learning-line-signature"] = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  let result: DeliveryStatus;
  try {
    const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(2_500) });
    result = { at: new Date().toISOString(), events: events.length, ok: res.ok, status: res.status, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (error) {
    result = { at: new Date().toISOString(), events: events.length, ok: false, status: null, error: error instanceof Error ? error.name : "error" };
  }
  state.learningLineLastDelivery = result;
  return result;
}
