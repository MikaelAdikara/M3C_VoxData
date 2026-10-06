import { describe, expect, it } from "vitest";

import { createSeedData } from "@/lib/seed";
import { MemoryStore } from "@/lib/store/memory";

describe("deterministic memory store", () => {
  it("creates the same isolated seed on every run", async () => {
    const first = createSeedData();
    const second = createSeedData();
    expect(second).toEqual(first);
    expect(first.alerts).toHaveLength(2_400);
    expect(first.cards.filter((card) => card.status === "validated")).toHaveLength(9);
    expect(first.cards.filter((card) => card.status === "draft")).toHaveLength(2);
    expect(first.cards.filter((card) => card.status === "retired")).toHaveLength(1);

    const st04Confirmed = first.alerts.filter(
      (alert) => alert.stationId === "st-04" && alert.status === "confirmed",
    );
    const share = (defectTypeId: string) =>
      st04Confirmed.filter((alert) => alert.defectTypeId === defectTypeId).length /
      st04Confirmed.length;
    expect(share("BEAD_THIN")).toBeCloseTo(0.38, 2);
    expect(share("BEAD_OFFSET")).toBeCloseTo(0.27, 2);
    expect(share("BEAD_BREAK")).toBeCloseTo(0.18, 2);
    expect(share("BEAD_EXCESS")).toBeCloseTo(0.12, 2);
    expect(share("BEAD_MISSING")).toBeCloseTo(0.05, 2);

    const store = new MemoryStore(first);
    const snapshot = await store.getSnapshot();
    snapshot.alerts.pop();
    expect((await store.getSnapshot()).alerts).toHaveLength(2_400);
  });

  it("resets mutated state to the original seed", async () => {
    const store = new MemoryStore();
    const snapshot = await store.getSnapshot();
    snapshot.stations.length = 0;
    await store.reset();
    expect((await store.getSnapshot()).stations).toHaveLength(8);
  });
});
