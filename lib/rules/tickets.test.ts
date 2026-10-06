import { describe, expect, it } from "vitest";

import { createSeedData } from "@/lib/seed";
import { getRepeatTicketTrigger } from "@/lib/rules/tickets";
import type { Alert, DefectTypeId, StoreSnapshot } from "@/lib/types";

function snapshotWith(alerts: Alert[]): StoreSnapshot {
  const snapshot = createSeedData();
  snapshot.alerts = alerts;
  snapshot.decisions = [];
  snapshot.tickets = [];
  return snapshot;
}

function confirmed(
  id: string,
  stationId = "st-04",
  defectTypeId: DefectTypeId = "BEAD_THIN",
): Alert {
  return {
    id,
    stationId,
    bodyId: `body-${id}`,
    roi: "seam-R-door-07",
    defectTypeId,
    anomalyScore: 0.8,
    threshold: 0.61,
    modelVersion: "test",
    image: "illustration.svg",
    mask: "mask.svg",
    createdAt: `2027-03-14T${String(7 + Number(id)).padStart(2, "0")}:00:00.000+07:00`,
    status: "confirmed",
  };
}

describe("repeat ticket trigger", () => {
  it.each([1, 2])("does not open a ticket at repeat count %i", (count) => {
    const snapshot = snapshotWith(Array.from({ length: count }, (_, index) => confirmed(`${index + 1}`)));
    expect(getRepeatTicketTrigger(snapshot, "st-04", "BEAD_THIN")).toBeNull();
  });

  it("opens on the third confirmed matching alert", () => {
    const snapshot = snapshotWith([confirmed("1"), confirmed("2"), confirmed("3")]);
    expect(getRepeatTicketTrigger(snapshot, "st-04", "BEAD_THIN")).toEqual({
      stationId: "st-04",
      defectTypeId: "BEAD_THIN",
      triggerAlertIds: ["1", "2", "3"],
    });
  });

  it("does not duplicate the active ticket at repeat four", () => {
    const snapshot = snapshotWith([
      confirmed("1"), confirmed("2"), confirmed("3"), confirmed("4"),
    ]);
    snapshot.tickets.push({
      id: "KZ-SEAL-001",
      stationId: "st-04",
      defectTypeId: "BEAD_THIN",
      triggerAlertIds: ["1", "2", "3"],
      ownerRole: "role:engineer@body",
      status: "open",
      a3: { background: "", currentCondition: "", rootCause: "", countermeasure: "", check: "", standardise: "" },
      aiPrefilledFields: [],
      createdAt: snapshot.currentShift.startsAt,
    });
    expect(getRepeatTicketTrigger(snapshot, "st-04", "BEAD_THIN")).toBeNull();
  });

  it("keeps another station and defect type outside the repeat", () => {
    const snapshot = snapshotWith([
      confirmed("1"),
      confirmed("2", "st-03"),
      confirmed("3", "st-04", "BEAD_OFFSET"),
    ]);
    expect(getRepeatTicketTrigger(snapshot, "st-04", "BEAD_THIN")).toBeNull();
  });

  it("excludes rejected alerts", () => {
    const rejected = { ...confirmed("3"), status: "rejected" as const };
    const snapshot = snapshotWith([confirmed("1"), confirmed("2"), rejected]);
    expect(getRepeatTicketTrigger(snapshot, "st-04", "BEAD_THIN")).toBeNull();
  });
});
