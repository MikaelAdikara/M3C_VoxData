import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })),
}));

import { getKaizenView, getKnowledgeView, getTicketView } from "@/lib/queries";
import { resetMemoryStore } from "@/lib/store/memory";

describe("BE-2 screen-ready queries", () => {
  beforeEach(async () => {
    await resetMemoryStore();
  });

  it("returns a sorted confirmed-defect Pareto and active ticket summaries", async () => {
    const view = await getKaizenView();
    expect(view.pareto.length).toBeGreaterThan(0);
    expect(view.pareto[0].count).toBeGreaterThanOrEqual(view.pareto.at(-1)!.count);
    expect(view.tickets.map((ticket) => ticket.id)).toEqual(
      expect.arrayContaining(["KZ-SEAL-007", "KZ-SEAL-008"]),
    );
    expect(view.tickets.every((ticket) => ticket.status !== "closed")).toBe(true);
  });

  it("returns ticket triggers, A3 prefill provenance, and validation readiness", async () => {
    const view = await getTicketView("KZ-SEAL-007");
    expect(view).toMatchObject({
      ticket: { id: "KZ-SEAL-007", status: "a3_in_progress" },
      aiPrefilledFields: ["background"],
      validation: { requiredFieldsComplete: false, draftCardId: null, canRequest: false },
    });
    expect(view?.triggerAlerts.map((alert) => alert.id)).toEqual([
      "alert-history-2301",
      "alert-history-2309",
      "alert-history-2317",
    ]);
    await expect(getTicketView("missing-ticket")).resolves.toBeNull();
  });

  it("filters current card revisions without exposing raw store joins", async () => {
    const view = await getKnowledgeView({ stationId: "st-04", status: "validated" });
    expect(view.cards.length).toBeGreaterThan(0);
    expect(view.cards.every((card) => card.status === "validated")).toBe(true);
    expect(view.cards.every((card) => card.stationIds.includes("st-04"))).toBe(true);
    expect(view.filters.statuses).toEqual(["draft", "validated", "retired"]);
    expect(view.filters.selected).toEqual({ stationId: "st-04", status: "validated" });
    expect(view.cards[0].revisions.length).toBeGreaterThan(0);
  });
});
