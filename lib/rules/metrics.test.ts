import { describe, expect, it } from "vitest";

import { calculateOverrideRate } from "@/lib/rules/metrics";

describe("override rate", () => {
  it("divides rejected decisions by all operator decisions", () => {
    expect(calculateOverrideRate(7, 3)).toBe(0.3);
  });

  it("returns zero when there are no operator decisions", () => {
    expect(calculateOverrideRate(0, 0)).toBe(0);
  });
});
