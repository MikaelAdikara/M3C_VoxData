import { describe, expect, it } from "vitest";

import { getNextTicketStatus, isA3Complete } from "@/lib/rules/lifecycle";
import type { Ticket } from "@/lib/types";

const completeA3 = {
  background: "Three confirmed repeats.",
  currentCondition: "Bead is thin at shift start.",
  rootCause: "Cold material raises viscosity.",
  countermeasure: "Run a warm-up purge.",
  check: "Trial met the pressure range.",
  standardise: "Revise start-up work.",
};

function ticket(status: Ticket["status"], a3 = completeA3): Ticket {
  return {
    id: "KZ-SEAL-999",
    stationId: "st-04",
    defectTypeId: "BEAD_THIN",
    triggerAlertIds: ["a", "b", "c"],
    ownerRole: "role:engineer@body",
    status,
    a3,
    aiPrefilledFields: [],
    createdAt: "2027-03-14T08:00:00.000+07:00",
  };
}

describe("ticket lifecycle", () => {
  it("follows open to A3, trial, validated, and closed gates", () => {
    expect(getNextTicketStatus(ticket("open"))).toBe("a3_in_progress");
    expect(getNextTicketStatus(ticket("a3_in_progress"))).toBe("countermeasure_trial");
    expect(getNextTicketStatus(ticket("countermeasure_trial"))).toBeNull();
    expect(getNextTicketStatus(ticket("validated"))).toBe("closed");
    expect(getNextTicketStatus(ticket("closed"))).toBeNull();
  });

  it("requires the working A3 fields before countermeasure trial", () => {
    expect(getNextTicketStatus(ticket("a3_in_progress", { ...completeA3, rootCause: "" }))).toBeNull();
  });

  it("requires all six A3 fields before validation request", () => {
    expect(isA3Complete(completeA3)).toBe(true);
    expect(isA3Complete({ ...completeA3, check: "" })).toBe(false);
  });
});
