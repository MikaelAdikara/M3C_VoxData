import { describe, expect, it } from "vitest";

import { getConfirmedRepeatState } from "@/lib/rules/repeat";
import type { Alert, Decision, DefectTypeId, Shift } from "@/lib/types";

const shift: Shift = {
  id: "shift-a",
  label: "A",
  startsAt: "2027-03-14T07:00:00.000+07:00",
  endsAt: "2027-03-14T15:30:00.000+07:00",
};

function alert(id: string, stationId = "st-04", defectTypeId: DefectTypeId = "BEAD_THIN"): Alert {
  return {
    id,
    stationId,
    bodyId: `body-${id}`,
    roi: "seam-R-door-07",
    defectTypeId,
    anomalyScore: 0.8,
    threshold: 0.61,
    modelVersion: "sealer-st04-v1.3",
    image: "/beads/test.svg",
    mask: "/beads/test-mask.svg",
    createdAt: `2027-03-14T08:0${id}:00.000+07:00`,
    status: "confirmed",
  };
}

describe("confirmed repeat rule", () => {
  it("stays below the ticket threshold after two matching confirmations", () => {
    const state = getConfirmedRepeatState([alert("1"), alert("2")], [], "st-04", "BEAD_THIN", shift);
    expect(state).toMatchObject({ count: 2, isThirdRepeat: false, thresholdReached: false });
  });

  it("identifies exactly the third matching confirmation", () => {
    const state = getConfirmedRepeatState(
      [alert("1"), alert("2"), alert("3")],
      [],
      "st-04",
      "BEAD_THIN",
      shift,
    );
    expect(state).toEqual({
      count: 3,
      alertIds: ["1", "2", "3"],
      isThirdRepeat: true,
      thresholdReached: true,
    });
  });

  it("does not count another station or defect type as the same repeat", () => {
    const alerts = [
      alert("1"),
      alert("2", "st-03"),
      alert("3", "st-04", "BEAD_OFFSET"),
    ];
    expect(getConfirmedRepeatState(alerts, [], "st-04", "BEAD_THIN", shift).count).toBe(1);
  });

  it("retains a closed alert when its operator confirmation is logged", () => {
    const closed = { ...alert("1"), status: "closed" as const };
    const decisions: Decision[] = [
      {
        id: "decision-1",
        alertId: closed.id,
        actor: "role:operator@st-04",
        kind: "confirm",
        createdAt: closed.createdAt,
      },
    ];
    expect(getConfirmedRepeatState([closed], decisions, "st-04", "BEAD_THIN", shift).count).toBe(1);
  });
});
