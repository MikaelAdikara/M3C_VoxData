import { describe, expect, it } from "vitest";

import { buildEvents, newEvents, summarizeEvent } from "@/lib/events/outbox";
import { createSeedData } from "@/lib/seed";

describe("event outbox", () => {
  const seed = createSeedData();

  it("turns alerts, decisions, tickets and validated cards into events, newest first", () => {
    const events = buildEvents(seed);
    const types = new Set(events.map((e) => e.type));
    for (const t of ["alert.raised", "andon.yellow", "alert.rejected", "ticket.opened", "card.validated"]) expect(types.has(t as never)).toBe(true);
    expect(Date.parse(events[0].timestamp)).toBeGreaterThanOrEqual(Date.parse(events.at(-1)!.timestamp));
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });

  it("names actors as roles or rules, never people, and carries no free-text notes", () => {
    for (const e of buildEvents(seed)) {
      expect(e.actor).toMatch(/^(role:|model:|rule:)/);
      expect(e.data).not.toHaveProperty("note");
    }
  });

  it("finds only the events a change created", () => {
    const after = structuredClone(seed);
    after.decisions.push({ id: "d-new", alertId: after.alerts[0].id, actor: "role:operator@st-04", kind: "confirm", createdAt: "2027-04-14T08:50:00.000+07:00" });
    const created = newEvents(seed, after);
    expect(created.map((e) => e.type)).toEqual(["andon.yellow"]);
    expect(summarizeEvent(created[0])).toMatch(/yellow andon/);
  });
});
