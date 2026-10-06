"use client";

import { useSyncExternalStore } from "react";

const fmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

function subscribe(onTick: () => void) {
  const id = window.setInterval(onTick, 15_000);
  return () => window.clearInterval(id);
}

/** Plant time (WIB) and the current shift label. Time renders after hydration. */
export function ShiftClock({ shiftLabel }: { shiftLabel: string }) {
  const time = useSyncExternalStore(subscribe, () => fmt.format(new Date()), () => null);
  return (
    <div className="clock" aria-label={`Shift ${shiftLabel}${time ? `, ${time}` : ""}`}>
      <div className="clock__time num">{time ?? "--:--"}</div>
      <div className="clock__shift">Shift {shiftLabel}</div>
    </div>
  );
}
