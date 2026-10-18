import { describe, expect, it } from "vitest";

import { HISTORY_CASES } from "@/lib/kaizen/history";
import { findSimilarCases, precisionAtK, sameDefectBaseline } from "@/lib/kaizen/similar";
import { defectTypes } from "@/lib/seed";

const name = (id: string) => defectTypes.find((d) => d.id === id)!.name;

describe("similar closed cases (AI-3)", () => {
  it("ranks the case written up in the matching validated card first", () => {
    const top = findSimilarCases({ stationId: "st-04", defectTypeId: "BEAD_THIN", defectName: "Thin bead", text: "thin bead on door seams at shift start" });
    expect(top[0].case.id).toBe("HC-001");
    expect(top[0].matched.length).toBeGreaterThan(0);
  });

  it("only ranks, never returns more than asked", () => {
    expect(findSimilarCases({ stationId: "st-02", defectTypeId: "BEAD_EXCESS", defectName: "Excess sealer", text: "blob" }, { limit: 3 })).toHaveLength(3);
  });

  it("beats picking same-defect cases at random on the labelled history", () => {
    expect(HISTORY_CASES.length).toBeGreaterThanOrEqual(30);
    expect(precisionAtK(name as never).precision).toBeGreaterThan(sameDefectBaseline());
  });
});
