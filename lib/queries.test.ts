import { beforeEach, describe, expect, it } from "vitest";

import { getShiftBoardView, getStationView } from "@/lib/queries";
import { resetMemoryStore } from "@/lib/store/memory";

describe("BE-0 view models", () => {
  beforeEach(async () => {
    await resetMemoryStore();
  });

  it("returns the latest open alert and UI-ready reason codes for st-04", async () => {
    const view = await getStationView("st-04");
    expect(view?.station.id).toBe("st-04");
    expect(view?.openAlert).toMatchObject({
      id: "alert-st04-open-001",
      roi: "seam-R-door-07",
      anomalyScore: 0.83,
      threshold: 0.61,
      modelVersion: "sealer-st04-v1.3",
      status: "open",
    });
    expect(view?.reasonCodes.map((reason) => reason.value)).toEqual([
      "reflection",
      "variant_mismatch",
      "dirty_lens",
      "within_tolerance",
      "other",
    ]);
  });

  it("returns null for an unknown station", async () => {
    await expect(getStationView("missing")).resolves.toBeNull();
  });

  it("shapes the shift board and flags st-02 above budget without hiding confirmed alerts", async () => {
    const view = await getShiftBoardView();
    expect(view.stations).toHaveLength(8);
    expect(view.stations.find((tile) => tile.station.id === "st-02")).toMatchObject({
      rejectedCount: 3,
      falseAlarmBudget: 2,
      modelReviewNeeded: true,
      overrideRate: 1,
    });
    expect(view.pendingDecisions.map((alert) => alert.id)).toContain("alert-st05-confirmed-001");
  });
});
