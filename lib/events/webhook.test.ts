import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkflowEvent } from "@/lib/events/outbox";
import { chatMessage, postEvents, webhookBodies, webhookFormat, webhookUrl } from "@/lib/events/webhook";

const event = { id: "andon.yellow:x", type: "andon.yellow" as const, topic: "t", timestamp: "2027-04-14T08:00:00Z", stationId: "st-04", actor: "role:operator@st-04", data: {} };

describe("workflow webhook", () => {
  afterEach(() => {
    delete process.env.WORKFLOW_WEBHOOK_URL;
    delete process.env.WORKFLOW_WEBHOOK_SECRET;
    delete process.env.WORKFLOW_WEBHOOK_FORMAT;
    vi.unstubAllGlobals();
  });

  it("does nothing without WORKFLOW_WEBHOOK_URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(webhookUrl()).toBeNull();
    expect(await postEvents([event])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the events, signs them when a secret is set, and never throws", async () => {
    process.env.WORKFLOW_WEBHOOK_URL = "https://hooks.example.test/learning-line";
    process.env.WORKFLOW_WEBHOOK_SECRET = "s3cret";
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await postEvents([event])).toMatchObject({ ok: true, events: 1 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(JSON.parse(init.body as string).events[0].type).toBe("andon.yellow");
    expect((init.headers as Record<string, string>)["x-learning-line-signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await postEvents([event])).toMatchObject({ ok: false });
  });

  it("keeps the JSON envelope by default; chat format is opt-in", () => {
    expect(webhookFormat()).toBe("events");
    process.env.WORKFLOW_WEBHOOK_FORMAT = "chat";
    expect(webhookFormat()).toBe("chat");
  });

  it("formats escalations as a Teams/Slack-compatible message: one {text} body per escalation", () => {
    const escalated: WorkflowEvent = {
      id: "step.not_done:step-0001",
      type: "step.not_done",
      topic: "learning-line/K2-Body/st-04/standard-step",
      timestamp: "2027-04-14T09:12:00.000+07:00",
      stationId: "st-04",
      actor: "role:team_leader@body",
      data: { step_id: "step-0001", step: "nozzle_purge", label: "Nozzle purge, 30 s", in_standard: "yes", source_card: "KC-SEAL-014", defect_type: "BEAD_THIN", alert_id: "a-1", ticket_id: "KZ-SEAL-007", reason_code: "robot_fault" },
    };
    const routine: WorkflowEvent = { ...event, id: "alert.raised:x", type: "alert.raised", data: { defect_type: "BEAD_THIN", roi: "seam", anomaly_score: 0.7, threshold: 0.61 } };

    const message = chatMessage(escalated)!;
    expect(Object.keys(message)).toEqual(["text"]);
    expect(message.text).toContain("st-04");
    expect(message.text).toContain("09:12 WIB");
    expect(message.text).toContain("not done, reason robot_fault");
    expect(message.text).toContain("Engineer");
    expect(message.text).toContain("simulated");
    expect(message.text).not.toMatch(/role:/);
    expect(chatMessage(routine)).toBeNull();
    expect(chatMessage(event, { test: true })!.text.startsWith("[TEST] ")).toBe(true);

    const bodies = webhookBodies([routine, event, escalated], "chat");
    expect(bodies).toHaveLength(2);
    for (const b of bodies) expect(Object.keys(JSON.parse(b.body))).toEqual(["text"]);
    expect(JSON.parse(webhookBodies([routine, escalated], "events")[0].body).events).toHaveLength(2);
  });

  it("posts one chat message per escalation when the chat format is on", async () => {
    process.env.WORKFLOW_WEBHOOK_URL = "https://chat.example.test/incoming";
    process.env.WORKFLOW_WEBHOOK_FORMAT = "chat";
    const fetchMock = vi.fn(async () => new Response("1", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const routine = { ...event, id: "alert.raised:y", type: "alert.raised" as const };
    expect(await postEvents([routine])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await postEvents([event, routine])).toMatchObject({ ok: true, events: 1 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ text: expect.stringContaining("yellow andon") });
  });
});
