import type { ShiftDecision } from "@/lib/types";

const time = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Jakarta",
});

/** Plant time (WIB) for an ISO timestamp, e.g. "08:42:17". */
export function plantTime(iso: string) {
  return time.format(new Date(iso));
}

export const DECISION_LABEL: Record<ShiftDecision, string> = {
  stop_fix: "Stop and fix",
  contain: "Contain",
  continue: "Continue with check",
};
