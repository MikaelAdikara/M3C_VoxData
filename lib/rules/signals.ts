import { REPEAT_TICKET_THRESHOLD, repeatStateOf, type RepeatState } from "@/lib/rules/repeat";
import type { LineSignal, Shift, StoreSnapshot } from "@/lib/types";

/**
 * Robot error codes and walk-check findings use the same repeat rule as bead alerts:
 * the third repeat of the same thing at the same place in one shift opens a Kaizen ticket.
 * "Same thing" is the same code on the same robot, or the same symptom on the same equipment.
 */
export function signalRepeatKey(signal: Pick<LineSignal, "source" | "equipmentId" | "code">): string {
  return `${signal.source}:${signal.equipmentId}:${signal.code}`;
}

export function getSignalRepeatState(
  signals: readonly LineSignal[],
  signal: Pick<LineSignal, "source" | "equipmentId" | "code">,
  shift: Shift,
): RepeatState {
  const key = signalRepeatKey(signal);
  return repeatStateOf(signals.filter((item) => signalRepeatKey(item) === key), shift);
}

export interface SignalTicketTrigger {
  stationId: string;
  source: LineSignal["source"];
  signalKey: string;
  triggerSignalIds: string[];
}

export function getSignalTicketTrigger(snapshot: StoreSnapshot, signal: LineSignal): SignalTicketTrigger | null {
  const repeat = getSignalRepeatState(snapshot.signals, signal, snapshot.currentShift);
  if (!repeat.thresholdReached) return null;
  const signalKey = signalRepeatKey(signal);
  const triggerSignalIds = repeat.alertIds.slice(0, REPEAT_TICKET_THRESHOLD);
  const handled = snapshot.tickets.some(
    (ticket) =>
      ticket.signalKey === signalKey &&
      (ticket.status !== "closed" || triggerSignalIds.every((id) => ticket.triggerSignalIds?.includes(id))),
  );
  if (handled) return null;
  return { stationId: signal.stationId, source: signal.source, signalKey, triggerSignalIds };
}
