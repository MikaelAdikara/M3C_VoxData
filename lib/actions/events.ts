"use server";

import { revalidatePaths } from "@/lib/action-support";
import type { WorkflowEvent } from "@/lib/events/outbox";
import { postEvents, webhookUrl } from "@/lib/events/webhook";
import type { ActionResult } from "@/lib/types";

/** Posts one sample yellow-andon event, marked as a test, to the configured workflow webhook. */
export async function sendTestEvent(): Promise<ActionResult> {
  try {
    if (!webhookUrl()) return { ok: false, error: "No WORKFLOW_WEBHOOK_URL is set on the server." };
    const now = new Date().toISOString();
    const event: WorkflowEvent = {
      id: `andon.yellow:test-${Date.parse(now)}`,
      type: "andon.yellow",
      topic: "learning-line/K2-Body/st-04/andon",
      timestamp: now,
      stationId: "st-04",
      actor: "role:operator@st-04",
      data: { alert_id: "test", body_id: "TEST-000000", roi: "seam-R-door-07", defect_type: "BEAD_BREAK", decided_by: "role:operator@st-04", decision: "confirmed" },
    };
    const result = await postEvents([event], { test: true });
    return result?.ok ? { ok: true } : { ok: false, error: `Webhook did not accept the test event (${result?.error ?? "no response"}).` };
  } finally {
    revalidatePaths(["/events"]);
  }
}
