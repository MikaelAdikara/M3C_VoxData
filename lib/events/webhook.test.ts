import { afterEach, describe, expect, it, vi } from "vitest";

import { postEvents, webhookUrl } from "@/lib/events/webhook";

const event = { id: "andon.yellow:x", type: "andon.yellow" as const, topic: "t", timestamp: "2027-03-14T08:00:00Z", stationId: "st-04", actor: "role:operator@st-04", data: {} };

describe("workflow webhook", () => {
  afterEach(() => {
    delete process.env.WORKFLOW_WEBHOOK_URL;
    delete process.env.WORKFLOW_WEBHOOK_SECRET;
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
});
