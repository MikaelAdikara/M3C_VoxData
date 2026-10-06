import { beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/assistant/route";
import { resetMemoryStore } from "@/lib/store/memory";

function request(body: string, ip: string): Request {
  return new Request("http://localhost/api/assistant", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body,
  });
}

describe("POST /api/assistant", () => {
  beforeEach(async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await resetMemoryStore();
  });

  it("returns a grounded offline answer without an API key", async () => {
    const response = await POST(request(JSON.stringify({ question: "thin bead shift start st-04" }), "route-grounded"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      mode: "offline",
      citations: [{ cardId: "KC-SEAL-014", revision: 3 }],
    });
  });

  it("returns no_card for an unsupported question", async () => {
    const response = await POST(request(JSON.stringify({ question: "paint orange peel" }), "route-no-card"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mode: "no_card",
      text: "No validated card covers this. Route the question to the owner engineer.",
      citations: [],
    });
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(request("{not-json", "route-malformed"));
    expect(response.status).toBe(400);
  });

  it("returns 429 after twenty requests from the same request key", async () => {
    const ip = "route-limit";
    for (let index = 0; index < 20; index += 1) {
      expect((await POST(request(JSON.stringify({ question: "paint orange peel" }), ip))).status).toBe(200);
    }
    const response = await POST(request(JSON.stringify({ question: "paint orange peel" }), ip));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
  });
});
