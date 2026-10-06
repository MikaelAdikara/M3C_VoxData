import { describe, expect, it } from "vitest";

import { createSeedData } from "@/lib/seed";

describe("deterministic seed quality", () => {
  const seed = createSeedData();

  it("keeps every ticket trigger traceable to three confirmed matching alerts", () => {
    for (const ticket of seed.tickets) {
      expect(ticket.triggerAlertIds).toHaveLength(3);
      const triggers = ticket.triggerAlertIds.map((id) => seed.alerts.find((alert) => alert.id === id));
      expect(triggers.every(Boolean)).toBe(true);
      expect(triggers.every((alert) => alert?.stationId === ticket.stationId)).toBe(true);
      expect(triggers.every((alert) => alert?.defectTypeId === ticket.defectTypeId)).toBe(true);
      expect(triggers.every((alert) => alert?.status === "confirmed")).toBe(true);
      expect(triggers.map((alert) => alert!.createdAt)).toEqual(
        [...triggers.map((alert) => alert!.createdAt)].sort(),
      );
    }
  });

  it("keeps KZ-SEAL-007 as a st-04 thin-bead repeat", () => {
    const ticket = seed.tickets.find((item) => item.id === "KZ-SEAL-007");
    expect(ticket).toMatchObject({ stationId: "st-04", defectTypeId: "BEAD_THIN" });
    expect(ticket?.triggerAlertIds).toHaveLength(3);
  });

  it("contains realistic judge-visible card content and the contracted status distribution", () => {
    const judgeVisibleFields = seed.cards.flatMap((card) => [
      card.symptom,
      card.rootCause,
      card.countermeasure,
      card.standardRevised,
    ]);
    expect(judgeVisibleFields.some((value) => /validated sealer symptom/i.test(value))).toBe(false);
    expect(judgeVisibleFields.some((value) => value.trim() === "—")).toBe(false);
    expect(judgeVisibleFields.every((value) => value.trim().length > 2)).toBe(true);
    expect(seed.cards.filter((card) => card.status === "validated")).toHaveLength(9);
    expect(seed.cards.filter((card) => card.status === "draft")).toHaveLength(2);
    expect(seed.cards.filter((card) => card.status === "retired")).toHaveLength(1);
  });
});
