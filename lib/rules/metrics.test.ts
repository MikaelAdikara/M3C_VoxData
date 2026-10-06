import { describe, expect, it } from "vitest";

import {
  calculateIdeaMetrics,
  calculateLearningCycleTimes,
  calculateOverrideRate,
  median,
} from "@/lib/rules/metrics";
import { createSeedData } from "@/lib/seed";

describe("override rate", () => {
  it("divides rejected decisions by all operator decisions", () => {
    expect(calculateOverrideRate(7, 3)).toBe(0.3);
  });

  it("returns zero when there are no operator decisions", () => {
    expect(calculateOverrideRate(0, 0)).toBe(0);
  });
});

describe("BE-3 metric derivation", () => {
  it("derives the seeded learning-cycle median from trigger and validation timestamps", () => {
    const seed = createSeedData();
    const cycles = calculateLearningCycleTimes(seed.tickets, seed.cards, seed.alerts);
    expect(cycles).toHaveLength(6);
    expect(cycles).toEqual(expect.arrayContaining([16, 18, 19, 19, 21, 22]));
    expect(median(cycles)).toBe(19);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBe(0);
  });

  it("derives idea totals, seven-day answers, and implemented counts", () => {
    expect(calculateIdeaMetrics(createSeedData().ideas)).toEqual({
      submitted: 40,
      answeredWithin7Days: 31,
      implemented: 11,
    });
  });
});
