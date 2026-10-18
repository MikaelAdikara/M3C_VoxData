import { describe, expect, it } from "vitest";

import { assessCrop, heatOpacity } from "@/lib/vision/assessment";

describe("camera crop assessment", () => {
  it("flags only above the seam threshold", () => {
    expect(assessCrop(4.1, 4).flagged).toBe(true);
    expect(assessCrop(4, 4).flagged).toBe(false);
    expect(assessCrop(2, 4).ratio).toBeCloseTo(0.5);
  });

  it("never claims the line stops by itself", () => {
    const a = assessCrop(9, 4);
    expect(a.nextStep).toMatch(/team leader decides/i);
    expect(a.nextStep).toMatch(/never stops on its own/i);
  });

  it("keeps the manual check for leak-critical seams when nothing is flagged", () => {
    expect(assessCrop(1, 4).nextStep).toMatch(/manual check/i);
  });

  it("scales heat opacity to the threshold", () => {
    expect(heatOpacity(1, 4)).toBe(0);
    expect(heatOpacity(2, 4)).toBe(0);
    expect(heatOpacity(5.2, 4)).toBe(1);
    expect(heatOpacity(3.6, 4)).toBeCloseTo(0.5);
    expect(heatOpacity(3, 0)).toBe(0);
  });
});
