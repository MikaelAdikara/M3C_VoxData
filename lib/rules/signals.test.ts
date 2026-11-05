import { describe, expect, it } from "vitest";

import { buildEvents } from "@/lib/events/outbox";
import { buildKaizenView } from "@/lib/queries";
import { openRepeatTicketIfNeeded, openSignalTicketIfNeeded } from "@/lib/repeat-ticket";
import { getConfirmedRepeatState, REPEAT_TICKET_THRESHOLD } from "@/lib/rules/repeat";
import { getSignalRepeatState, getSignalTicketTrigger, signalRepeatKey } from "@/lib/rules/signals";
import { createSeedData } from "@/lib/seed";
import type { Alert, LineSignal, Shift, StoreSnapshot } from "@/lib/types";

const shift: Shift = {
  id: "shift-a",
  label: "A",
  startsAt: "2027-04-14T07:00:00.000+07:00",
  endsAt: "2027-04-14T15:30:00.000+07:00",
};

function robot(id: string, minute: number, overrides: Partial<LineSignal> = {}): LineSignal {
  return {
    id,
    source: "robot_error",
    stationId: "st-04",
    equipmentId: "st-04/robot-1",
    code: "E-2210",
    actor: "controller:st-04/robot-1",
    createdAt: `2027-04-14T09:${String(minute).padStart(2, "0")}:00.000+07:00`,
    ...overrides,
  };
}

function walk(id: string, minute: number, overrides: Partial<LineSignal> = {}): LineSignal {
  return {
    id,
    source: "walk_check",
    stationId: "st-04",
    equipmentId: "st-04/hose",
    code: "cable_wear",
    actor: "role:operator@st-04",
    createdAt: `2027-04-14T10:${String(minute).padStart(2, "0")}:00.000+07:00`,
    ...overrides,
  };
}

function bead(id: string, minute: number): Alert {
  return {
    id, stationId: "st-04", bodyId: `K2-27-0399${minute}`, roi: "seam-R-door-07", defectTypeId: "BEAD_THIN",
    anomalyScore: 0.7, threshold: 0.61, modelVersion: "sealer-st04-v1.3", image: "", mask: "",
    createdAt: `2027-04-14T11:${String(minute).padStart(2, "0")}:00.000+07:00`, status: "confirmed",
  };
}

describe("one repeat rule for three signal sources", () => {
  it("uses the same threshold for bead alerts, robot error codes and walk-checks", () => {
    const beads = getConfirmedRepeatState([bead("b1", 1), bead("b2", 2), bead("b3", 3)], [], "st-04", "BEAD_THIN", shift);
    const robots = getSignalRepeatState([robot("r1", 1), robot("r2", 2), robot("r3", 3)], robot("x", 0), shift);
    const walks = getSignalRepeatState([walk("w1", 1), walk("w2", 2), walk("w3", 3)], walk("x", 0), shift);
    for (const state of [beads, robots, walks]) {
      expect(state).toMatchObject({ count: REPEAT_TICKET_THRESHOLD, isThirdRepeat: true, thresholdReached: true });
    }
  });

  it("robot: counts only the same code on the same robot in this shift", () => {
    const signals = [
      robot("r1", 1),
      robot("r2", 2, { code: "E-1043" }),
      robot("r3", 3, { equipmentId: "st-04/robot-2", actor: "controller:st-04/robot-2" }),
      robot("r4", 4, { createdAt: "2027-04-13T09:04:00.000+07:00" }),
      robot("r5", 5),
    ];
    const state = getSignalRepeatState(signals, robot("x", 0), shift);
    expect(state).toMatchObject({ count: 2, alertIds: ["r1", "r5"], thresholdReached: false });
  });

  it("walk-check: counts only the same symptom on the same equipment", () => {
    const signals = [walk("w1", 1), walk("w2", 2, { code: "noise" }), walk("w3", 3, { equipmentId: "st-04/pump" }), walk("w4", 4)];
    expect(getSignalRepeatState(signals, walk("x", 0), shift).count).toBe(2);
    expect(signalRepeatKey(walk("x", 0))).not.toBe(signalRepeatKey(robot("x", 0)));
  });

  function withSignals(signals: LineSignal[]): StoreSnapshot {
    const snapshot = createSeedData();
    snapshot.signals.push(...signals);
    return snapshot;
  }

  it("robot: the third code opens one ticket in the same list and outbox, marked as a robot error", () => {
    const snapshot = withSignals([robot("r1", 1), robot("r2", 2)]);
    expect(getSignalTicketTrigger(snapshot, snapshot.signals.at(-1)!)).toBeNull();
    snapshot.signals.push(robot("r3", 3));
    const ticket = openSignalTicketIfNeeded(snapshot, snapshot.signals.at(-1)!);
    expect(ticket).toMatchObject({ source: "robot_error", defectTypeId: null, triggerSignalIds: ["r1", "r2", "r3"], status: "open" });
    expect(ticket!.id).toMatch(/^KZ-SEAL-\d{3}$/);
    // A fourth repeat does not open a second ticket while the first is open.
    snapshot.signals.push(robot("r4", 4));
    expect(openSignalTicketIfNeeded(snapshot, snapshot.signals.at(-1)!)).toBeNull();

    const summary = buildKaizenView(snapshot).tickets.find((t) => t.id === ticket!.id);
    expect(summary).toMatchObject({ source: "robot_error", defectType: null, subject: expect.stringContaining("E-2210") });
    const events = buildEvents(snapshot);
    expect(events.find((e) => e.id === `ticket.opened:${ticket!.id}`)?.data).toMatchObject({ signal_source: "robot_error", trigger_signals: 3 });
    expect(events.filter((e) => e.type === "signal.robot_error" && ["r1", "r2", "r3", "r4"].includes(String(e.data.signal_id)))).toHaveLength(4);
  });

  it("walk-check: the third finding opens a ticket marked as a walk-check", () => {
    const snapshot = withSignals([walk("w1", 1), walk("w2", 2), walk("w3", 3, { photoAttached: true })]);
    const ticket = openSignalTicketIfNeeded(snapshot, snapshot.signals.at(-1)!);
    expect(ticket).toMatchObject({ source: "walk_check", signalKey: "walk_check:st-04/hose:cable_wear" });
    const event = buildEvents(snapshot).find((e) => e.id === "signal.walk_check:w3");
    expect(event?.data).toMatchObject({ symptom: "cable_wear", photo_attached: "yes" });
    expect(event?.data).not.toHaveProperty("note");
  });

  it("bead: the existing rule still opens tickets with the bead source", () => {
    const snapshot = createSeedData();
    const alerts = [1, 2, 3].map((m) => ({ ...bead(`b${m}`, m), defectTypeId: "BEAD_MISSING" as const }));
    snapshot.alerts.push(...alerts);
    const ticket = openRepeatTicketIfNeeded(snapshot, alerts[2]);
    expect(ticket).toMatchObject({ defectTypeId: "BEAD_MISSING", triggerAlertIds: ["b1", "b2", "b3"] });
    expect(buildKaizenView(snapshot).tickets.find((t) => t.id === ticket!.id)?.source).toBe("bead");
  });

  it("seed history never reached the rule, so it opened no signal ticket", () => {
    const seed = createSeedData();
    expect(seed.signals.length).toBeGreaterThan(0);
    expect(seed.tickets.some((t) => t.source && t.source !== "bead")).toBe(false);
    const perDay = new Map<string, number>();
    for (const s of seed.signals) {
      const key = `${signalRepeatKey(s)}@${s.createdAt.slice(0, 10)}`;
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    expect(Math.max(...perDay.values())).toBeLessThan(REPEAT_TICKET_THRESHOLD);
  });
});
