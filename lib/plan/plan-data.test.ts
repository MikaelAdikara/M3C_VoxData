import { describe, expect, it } from "vitest";

import { CUMULATIVE_CASH, DECISIONS, LEVERS, PHASES, QUARTERS } from "@/lib/plan/plan-data";

describe("implementation plan data (proposal v25, financial model)", () => {
  it("adds up to the proposal's totals", () => {
    expect(PHASES.reduce((s, p) => s + p.investment, 0)).toBeCloseTo(56.35, 2); // Rp56.4 bn
    expect(LEVERS.reduce((s, l) => s + l.value, 0)).toBeCloseTo(35.2, 1);
  });

  it("puts the peak cash need at Rp29.6 bn in Q1 2029", () => {
    const min = Math.min(...CUMULATIVE_CASH);
    expect(min).toBeCloseTo(-29.6, 1);
    expect(QUARTERS[CUMULATIVE_CASH.indexOf(min)]).toBe("Q1 2029");
    expect(CUMULATIVE_CASH).toHaveLength(QUARTERS.length);
  });

  it("orders the decisions in time", () => {
    const idx = DECISIONS.map((d) => QUARTERS.indexOf(d.quarter));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
});
