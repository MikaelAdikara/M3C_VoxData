import { describe, expect, it } from "vitest";

import { getShiftRecommendation } from "@/lib/rules/recommend";

describe("team leader recommendation", () => {
  it("recommends stop and fix for a leak-critical defect", () => {
    expect(getShiftRecommendation("leak_critical", 1)).toMatchObject({
      decision: "stop_fix",
      text: "Stop and fix: leak-critical; body held for repair",
      suggestedBy: "system",
    });
  });

  it("recommends containment for a repeated non-critical defect", () => {
    expect(getShiftRecommendation("non_critical", 2)).toMatchObject({
      decision: "contain",
      text: "Contain: check the last N bodies at this station",
    });
  });

  it("recommends continue with check for a normal non-critical alert", () => {
    expect(getShiftRecommendation("non_critical", 1)).toMatchObject({
      decision: "continue",
      text: "Continue with check: repair at station, monitor",
    });
  });
});
