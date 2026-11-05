import { describe, expect, it } from "vitest";

import { buildEvents } from "@/lib/events/outbox";
import { buildKaizenView } from "@/lib/queries";
import { MAINTENANCE_OWNER, openRepeatTicketIfNeeded, openRobotTicketIfNeeded, routeWalkCheck } from "@/lib/repeat-ticket";
import {
  getRobotTicketTrigger,
  PARETO_RULE,
  returnedAfterClosedWorkOrder,
  robotCodeWeek,
  robotPareto,
  signalKey,
} from "@/lib/rules/signals";
import { createSeedData } from "@/lib/seed";
import type { Alert, LineSignal, StoreSnapshot } from "@/lib/types";

const DAY = 86_400_000;
const NOW = "2027-04-14T08:45:00.000+07:00";
const daysAgo = (days: number) => new Date(Date.parse(NOW) - days * DAY).toISOString();

function robot(id: string, createdAt: string, overrides: Partial<LineSignal> = {}): LineSignal {
  return {
    id,
    source: "robot_error",
    stationId: "st-04",
    equipmentId: "st-04/robot-1",
    code: "E-0562",
    actor: "controller:st-04/robot-1",
    createdAt,
    ...overrides,
  };
}

function walk(id: string, minute: number, overrides: Partial<LineSignal> = {}): LineSignal {
  return {
    id,
    source: "walk_check",
    stationId: "st-04",
    equipmentId: "st-04/robot-2",
    code: "noise",
    actor: "role:operator@st-04",
    createdAt: `2027-04-14T10:${String(minute).padStart(2, "0")}:00.000+07:00`,
    ...overrides,
  };
}

function bead(id: string, minute: number): Alert {
  return {
    id, stationId: "st-04", bodyId: `K2-27-0399${minute}`, roi: "seam-R-door-07", defectTypeId: "BEAD_MISSING",
    anomalyScore: 0.7, threshold: 0.61, modelVersion: "sealer-st04-v1.3", image: "", mask: "",
    createdAt: `2027-04-14T11:${String(minute).padStart(2, "0")}:00.000+07:00`, status: "confirmed",
  };
}

const KEY = "robot_error:st-04/robot-1:E-0562";

describe("robot error code: rises in the weekly Pareto", () => {
  it("needs this week >= 5 and >= 2x the trailing 4-week weekly average", () => {
    expect(PARETO_RULE).toEqual({ minThisWeek: 5, multiple: 2, trailingWeeks: 4 });
    // Trailing weeks 3, 3, 3, 2: average 2.75, so this week needs 6.
    const trailing = [8, 9, 10, 15, 16, 17, 22, 23, 24, 29, 30].map((d, i) => robot(`t${i}`, daysAgo(d)));
    const four = [1, 2, 3, 4].map((d, i) => robot(`n${i}`, daysAgo(d)));
    expect(robotCodeWeek([...trailing, ...four], KEY, NOW)).toMatchObject({ thisWeek: 4, trailing: [3, 3, 3, 2], needed: 6, rising: false });

    const low = [8, 15, 22, 29].map((d, i) => robot(`l${i}`, daysAgo(d)));
    const five = [1, 2, 3, 4, 5].map((d, i) => robot(`f${i}`, daysAgo(d)));
    expect(robotCodeWeek([...low, ...five], KEY, NOW)).toMatchObject({ thisWeek: 5, trailingAverage: 1, needed: 5, rising: true });
    // Five is not enough when the code is always that high.
    const high = Array.from({ length: 16 }, (_, i) => robot(`h${i}`, daysAgo(8 + (i % 4) * 7)));
    expect(robotCodeWeek([...high, ...five], KEY, NOW)).toMatchObject({ thisWeek: 5, trailingAverage: 4, needed: 8, rising: false });
  });

  it("counts only the same code on the same robot, and nothing after now", () => {
    const signals = [
      robot("a", daysAgo(1)),
      robot("b", daysAgo(1), { code: "E-1043" }),
      robot("c", daysAgo(1), { equipmentId: "st-04/robot-2" }),
      robot("d", new Date(Date.parse(NOW) + 60_000).toISOString()),
    ];
    expect(robotCodeWeek(signals, KEY, NOW).thisWeek).toBe(1);
    expect(signalKey(signals[0])).toBe(KEY);
  });

  it("seed: E-2210 on sealer robot 1 at st-04 is one short of the rule; E-1043 is high but steady", () => {
    const seed = createSeedData();
    const rows = robotPareto(seed);
    expect(rows.find((r) => r.key === "robot_error:st-04/robot-1:E-2210")).toMatchObject({ thisWeek: 4, trailingAverage: 1.5, needed: 5, rising: false });
    expect(rows.find((r) => r.key === "robot_error:st-04/robot-1:E-1043")).toMatchObject({ thisWeek: 9, rising: false });
    expect(rows.some((r) => r.rising)).toBe(false);
    expect(seed.tickets.some((t) => t.source && t.source !== "bead")).toBe(false);
  });

  it("the report that crosses the rule opens one maintenance ticket, not one per shift count", () => {
    const snapshot = createSeedData();
    const add = (id: string) => {
      const signal = robot(id, "2027-04-14T09:00:00.000+07:00", { code: "E-2210" });
      snapshot.signals.push(signal);
      return openRobotTicketIfNeeded(snapshot, signal);
    };
    const ticket = add("x1");
    expect(ticket).toMatchObject({ source: "robot_error", defectTypeId: null, ownerRole: MAINTENANCE_OWNER, signalKey: "robot_error:st-04/robot-1:E-2210" });
    expect(ticket!.triggerSignalIds).toHaveLength(5);
    expect(ticket!.a3.background).toMatch(/weekly Pareto: 5 this week against a trailing 4-week average of 1\.5/);
    expect(add("x2")).toBeNull();
    expect(getRobotTicketTrigger(snapshot, snapshot.signals.at(-1)!)).toBeNull();

    const event = buildEvents(snapshot).find((e) => e.id === `ticket.opened:${ticket!.id}`);
    expect(event).toMatchObject({ actor: "rule:weekly-pareto-rise", data: { signal_source: "robot_error", owner_role: "role:maintenance@body" } });
    expect(buildKaizenView(snapshot).tickets.find((t) => t.id === ticket!.id)).toMatchObject({ source: "robot_error", ownerRole: MAINTENANCE_OWNER });
  });
});

describe("walk-check finding: back after its work order closed", () => {
  function snapshotWith(): StoreSnapshot {
    return createSeedData();
  }
  function log(snapshot: StoreSnapshot, signal: LineSignal) {
    snapshot.signals.push(signal);
    return routeWalkCheck(snapshot, signal);
  }

  it("a finding opens a work order; the same finding while it is open joins it", () => {
    const snapshot = snapshotWith();
    const first = log(snapshot, walk("w1", 1));
    expect(first.ticket).toBeNull();
    expect(first.workOrder).toMatchObject({ status: "open", findingIds: ["w1"], equipmentId: "st-04/robot-2", symptom: "noise" });
    const second = log(snapshot, walk("w2", 2));
    expect(second.workOrder.id).toBe(first.workOrder.id);
    expect(second.workOrder.findingIds).toEqual(["w1", "w2"]);
    expect(second.ticket).toBeNull();
    // A third the same shift still opens no ticket: the old shift count is gone.
    expect(log(snapshot, walk("w3", 3)).ticket).toBeNull();
    expect(snapshot.tickets.some((t) => t.source === "walk_check")).toBe(false);
  });

  it("closed, then the same finding again: a new work order and a maintenance ticket", () => {
    const snapshot = snapshotWith();
    const { workOrder } = log(snapshot, walk("w1", 1));
    workOrder.status = "closed";
    workOrder.closedAt = "2027-04-14T10:05:00.000+07:00";
    workOrder.closedBy = MAINTENANCE_OWNER;

    // A different symptom on the same equipment is not a return.
    expect(log(snapshot, walk("w2", 6, { code: "leak" })).ticket).toBeNull();
    expect(returnedAfterClosedWorkOrder(snapshot, walk("probe", 7))).toMatchObject({ id: workOrder.id });

    const back = log(snapshot, walk("w3", 8));
    expect(back.workOrder).toMatchObject({ status: "open", returnOf: workOrder.id });
    expect(back.ticket).toMatchObject({
      source: "walk_check",
      ownerRole: MAINTENANCE_OWNER,
      returnedAfterWorkOrderId: workOrder.id,
      triggerSignalIds: ["w1", "w3"],
      signalKey: "walk_check:st-04/robot-2:noise",
    });
    expect(back.ticket!.a3.background).toMatch(new RegExp(`came back after work order ${workOrder.id} was closed`));

    const types = buildEvents(snapshot).filter((e) => e.stationId === "st-04").map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["work_order.opened", "work_order.closed", "ticket.opened"]));
    expect(buildEvents(snapshot).find((e) => e.id === `ticket.opened:${back.ticket!.id}`)).toMatchObject({ actor: "rule:finding-back-after-work-order" });
  });

  it("seed: work orders match the findings and none of them came back", () => {
    const seed = createSeedData();
    expect(seed.workOrders.map((o) => o.status)).toEqual(["closed", "closed", "open", "open"]);
    for (const order of seed.workOrders) {
      for (const id of order.findingIds) expect(seed.signals.find((s) => s.id === id)?.equipmentId).toBe(order.equipmentId);
    }
  });
});

describe("bead alerts keep their shift repeat rule", () => {
  it("the third confirmed bead defect in a shift opens an engineer-owned ticket", () => {
    const snapshot = createSeedData();
    const alerts = [1, 2, 3].map((m) => bead(`b${m}`, m));
    snapshot.alerts.push(...alerts);
    const ticket = openRepeatTicketIfNeeded(snapshot, alerts[2]);
    expect(ticket).toMatchObject({ defectTypeId: "BEAD_MISSING", triggerAlertIds: ["b1", "b2", "b3"], ownerRole: "role:engineer@body" });
    expect(buildKaizenView(snapshot).tickets.find((t) => t.id === ticket!.id)?.source).toBe("bead");
  });
});
