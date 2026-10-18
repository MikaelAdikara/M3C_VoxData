import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { BEAD_H, BEAD_W, hash01, renderBead, seamId, toModelInput, type BeadParams } from "@/lib/vision/beadsynth";

interface FixtureCase {
  params: BeadParams;
  rows: [number, number];
  cols: [number, number];
  shape: [number, number, number];
  pixels: string;
}

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../ml/results/parity_fixture.json", import.meta.url)), "utf8"),
) as { width: number; height: number; cases: FixtureCase[] };

describe("bead generator twin", () => {
  it("uses the same crop size as the Python generator", () => {
    expect([fixture.width, fixture.height]).toEqual([BEAD_W, BEAD_H]);
  });

  it("names seams like the seed data", () => {
    expect(seamId(2)).toBe("seam-L-door-03");
    expect(seamId(6)).toBe("seam-R-door-07");
    expect(seamId(11)).toBe("seam-L-roof-12");
    expect(seamId(15)).toBe("seam-R-roof-16");
  });

  it("hashes into [0, 1)", () => {
    const v = hash01(255, 95, 2147483646, 5);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it.each(fixture.cases.map((c) => [c.params.defect.type, c] as const))(
    "matches the Python render for a %s crop",
    (_type, c) => {
      const rgba = renderBead(c.params);
      const expected = Buffer.from(c.pixels, "base64");
      const [rows, cols] = c.shape;
      let maxDiff = 0;
      let off = 0;
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < cols; k++) {
          const y = c.rows[0] + r * c.rows[1];
          const x = c.cols[0] + k * c.cols[1];
          for (let ch = 0; ch < 3; ch++) {
            maxDiff = Math.max(maxDiff, Math.abs(rgba[(y * BEAD_W + x) * 4 + ch] - expected[off++]));
          }
        }
      }
      // Floating-point sin/exp may differ in the last bit between numpy and V8.
      expect(maxDiff).toBeLessThanOrEqual(1);
    },
  );

  it("packs RGBA into planar model input", () => {
    const rgba = new Uint8ClampedArray(BEAD_W * BEAD_H * 4).fill(255);
    rgba[0] = 0;
    const input = toModelInput(rgba);
    expect(input.length).toBe(3 * BEAD_W * BEAD_H);
    expect(input[0]).toBe(0);
    expect(input[BEAD_W * BEAD_H]).toBe(1);
  });
});
