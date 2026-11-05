import { simulatedNow } from "@/lib/simulation-clock";
import type { LineSignal, StoreSnapshot, WorkOrder } from "@/lib/types";

/**
 * Two trigger rules for non-camera signals. Neither counts repeats in a shift:
 *  - Robot error code: a code on one robot rises in the weekly Pareto
 *    (this week >= 5 and >= 2x its trailing 4-week weekly average).
 *  - Walk-check finding: the same finding (equipment + symptom) comes back after its
 *    work order was closed.
 * Both open a Kaizen ticket owned by maintenance.
 */

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export const PARETO_RULE = { minThisWeek: 5, multiple: 2, trailingWeeks: 4 } as const;
export const PARETO_RULE_TEXT = `This week ≥ ${PARETO_RULE.minThisWeek} and ≥ ${PARETO_RULE.multiple}× the trailing ${PARETO_RULE.trailingWeeks}-week weekly average`;
export const WALK_CHECK_RULE_TEXT = "The same finding (equipment + symptom) comes back after its work order was closed";

/** "robot_error:st-04/robot-1:E-2210" or "walk_check:st-04/hose:cable_wear". */
export function signalKey(signal: Pick<LineSignal, "source" | "equipmentId" | "code">): string {
  return `${signal.source}:${signal.equipmentId}:${signal.code}`;
}

export interface RobotCodeWeek {
  key: string;
  equipmentId: string;
  code: string;
  thisWeek: number;
  /** Counts for the four weeks before this one, most recent first. */
  trailing: number[];
  trailingAverage: number;
  /** Count this week needs to meet the rule. */
  needed: number;
  rising: boolean;
  thisWeekSignalIds: string[];
}

/** This week is the seven days up to the simulated now; the trailing weeks are the 28 days before it. */
export function robotCodeWeek(signals: readonly LineSignal[], key: string, now: string): RobotCodeWeek {
  const end = Date.parse(now);
  const [, equipmentId = "", code = ""] = key.split(":");
  const matching = signals
    .filter((s) => s.source === "robot_error" && signalKey(s) === key && Date.parse(s.createdAt) <= end)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const weekOf = (s: LineSignal) => Math.floor((end - Date.parse(s.createdAt)) / WEEK_MS);
  const thisWeekSignals = matching.filter((s) => weekOf(s) === 0);
  const trailing = Array.from({ length: PARETO_RULE.trailingWeeks }, (_, i) => matching.filter((s) => weekOf(s) === i + 1).length);
  const trailingAverage = trailing.reduce((sum, n) => sum + n, 0) / PARETO_RULE.trailingWeeks;
  const needed = Math.max(PARETO_RULE.minThisWeek, Math.ceil(PARETO_RULE.multiple * trailingAverage));
  const thisWeek = thisWeekSignals.length;
  return {
    key,
    equipmentId,
    code,
    thisWeek,
    trailing,
    trailingAverage,
    needed,
    rising: thisWeek >= PARETO_RULE.minThisWeek && thisWeek >= PARETO_RULE.multiple * trailingAverage,
    thisWeekSignalIds: thisWeekSignals.map((s) => s.id),
  };
}

/** Every code on every robot seen in the last five weeks, highest this week first. */
export function robotPareto(snapshot: StoreSnapshot): RobotCodeWeek[] {
  const now = simulatedNow(snapshot);
  const since = Date.parse(now) - (PARETO_RULE.trailingWeeks + 1) * WEEK_MS;
  const keys = new Set(
    snapshot.signals.filter((s) => s.source === "robot_error" && Date.parse(s.createdAt) > since).map(signalKey),
  );
  return [...keys]
    .map((key) => robotCodeWeek(snapshot.signals, key, now))
    .sort((a, b) => b.thisWeek - a.thisWeek || a.key.localeCompare(b.key));
}

export interface SignalTicketTrigger {
  stationId: string;
  source: LineSignal["source"];
  signalKey: string;
  triggerSignalIds: string[];
  week?: RobotCodeWeek;
  closedWorkOrder?: WorkOrder;
}

const openTicketFor = (snapshot: StoreSnapshot, key: string) =>
  snapshot.tickets.some((ticket) => ticket.signalKey === key && ticket.status !== "closed");

/** A robot code that has just risen in the weekly Pareto, unless an open ticket already covers it. */
export function getRobotTicketTrigger(snapshot: StoreSnapshot, signal: LineSignal): SignalTicketTrigger | null {
  if (signal.source !== "robot_error") return null;
  const key = signalKey(signal);
  const week = robotCodeWeek(snapshot.signals, key, simulatedNow(snapshot));
  if (!week.rising || openTicketFor(snapshot, key)) return null;
  return { stationId: signal.stationId, source: "robot_error", signalKey: key, triggerSignalIds: week.thisWeekSignalIds, week };
}

export function workOrderKey(order: Pick<WorkOrder, "equipmentId" | "symptom">): string {
  return `walk_check:${order.equipmentId}:${order.symptom}`;
}

/** The latest closed work order for this finding, when no open one exists: the finding has returned. */
export function returnedAfterClosedWorkOrder(snapshot: StoreSnapshot, signal: LineSignal): WorkOrder | null {
  if (signal.source !== "walk_check") return null;
  const key = signalKey(signal);
  const orders = snapshot.workOrders.filter((order) => workOrderKey(order) === key);
  if (orders.some((order) => order.status === "open")) return null;
  const closed = orders
    .filter((order) => order.closedAt && Date.parse(order.closedAt) <= Date.parse(signal.createdAt))
    .sort((a, b) => b.closedAt!.localeCompare(a.closedAt!));
  return closed[0] ?? null;
}

/** A walk-check finding back after its work order closed, unless an open ticket already covers it. */
export function getWalkCheckTicketTrigger(snapshot: StoreSnapshot, signal: LineSignal): SignalTicketTrigger | null {
  const closed = returnedAfterClosedWorkOrder(snapshot, signal);
  if (!closed) return null;
  const key = signalKey(signal);
  if (openTicketFor(snapshot, key)) return null;
  return {
    stationId: signal.stationId,
    source: "walk_check",
    signalKey: key,
    triggerSignalIds: [...closed.findingIds, signal.id],
    closedWorkOrder: closed,
  };
}
