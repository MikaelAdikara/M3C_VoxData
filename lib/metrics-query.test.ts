import { beforeEach, describe, expect, it } from "vitest";

import { getMetricsView } from "@/lib/queries";
import { resetMemoryStore } from "@/lib/store/memory";

describe("getMetricsView", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    await resetMemoryStore();
  });

  it("returns screen-ready simulated Gate 1 values with explicit sources", async () => {
    const view = await getMetricsView();
    expect(view.dataLabel).toBe("Simulated data");
    expect(view.learningCycleDays).toBe(19);
    expect(view.ideas).toEqual({ submitted: 40, answeredWithin7Days: 31, implemented: 11 });
    expect(view.overrideRate).toMatchObject({
      baselinePercent: 31,
      currentPercent: 24,
      gate1TargetPercent: 20,
      year2030TargetPercent: 10,
    });
    expect(view.gate1.find((kpi) => kpi.id === "scrap-index")).toMatchObject({
      baseline: 108,
      target: 96,
      sourceLabel: "Casebook Exhibit 4; ES Table 4",
    });
    expect(view.gate1.every((kpi) => kpi.sourceLabel.trim().length > 0)).toBe(true);
  });

  it("derives current-shift false alarms by station and preserves the budget boundary", async () => {
    const view = await getMetricsView();
    expect(view.falseAlarms.find((item) => item.station.id === "st-02")).toMatchObject({
      count: 3,
      budget: 2,
      withinBudget: false,
    });
    expect(view.falseAlarms.find((item) => item.station.id === "st-04")).toMatchObject({
      count: 0,
      budget: 2,
      withinBudget: true,
    });
  });
});
