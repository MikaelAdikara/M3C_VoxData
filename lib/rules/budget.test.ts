import { describe, expect, it } from "vitest";

import { getFalseAlarmBudgetState } from "@/lib/rules/budget";
import type { Alert, Shift } from "@/lib/types";

const shift: Shift = {
  id: "shift-a",
  label: "A",
  startsAt: "2027-03-14T07:00:00.000+07:00",
  endsAt: "2027-03-14T15:30:00.000+07:00",
};

function alert(id: string, status: Alert["status"]): Alert {
  return {
    id,
    stationId: "st-02",
    bodyId: `body-${id}`,
    roi: "seam-L-door-03",
    defectTypeId: "BEAD_THIN",
    anomalyScore: 0.7,
    threshold: 0.61,
    modelVersion: "sealer-st04-v1.3",
    image: "/beads/test.svg",
    mask: "/beads/test-mask.svg",
    createdAt: "2027-03-14T08:00:00.000+07:00",
    status,
  };
}

describe("false-alarm budget", () => {
  it.each([
    [0, 2, false],
    [1, 1, false],
    [2, 0, false],
    [3, 0, true],
  ])("handles %i rejected alerts", (count, remaining, exceeded) => {
    const alerts = Array.from({ length: count }, (_, index) => alert(`r-${index}`, "rejected"));
    expect(getFalseAlarmBudgetState(alerts, [], "st-02", shift)).toMatchObject({
      count,
      budget: 2,
      remaining,
      exceeded,
    });
  });

  it("does not alter or suppress a confirmed defect when the budget is exceeded", () => {
    const confirmed = alert("confirmed", "confirmed");
    const alerts = [confirmed, ...Array.from({ length: 3 }, (_, index) => alert(`r-${index}`, "rejected"))];
    const state = getFalseAlarmBudgetState(alerts, [], "st-02", shift);
    expect(state.exceeded).toBe(true);
    expect(confirmed.status).toBe("confirmed");
    expect(state.rejectedAlertIds).not.toContain(confirmed.id);
  });
});
