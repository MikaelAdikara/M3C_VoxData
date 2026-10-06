import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import type { Loop } from "@/lib/types";

export type BadgeTone = "neutral" | "outline" | "stop" | "caution" | "safe" | "instruct" | "ai";

/** Small pill label. Signal tones only for state, never for categories. */
export function Badge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={tone === "neutral" ? "badge" : `badge badge--${tone}`}>
      {icon}
      {children}
    </span>
  );
}

const ANDON = {
  yellow: { tone: "caution", icon: "bell-ringing", weight: "fill", label: "Yellow andon" },
  stopped: { tone: "stop", icon: "hand-palm", weight: "fill", label: "Stopped by team leader" },
  review: { tone: "instruct", icon: "wrench", weight: "bold", label: "Model review needed" },
} as const;

/**
 * Andon state of a station. "stopped" is only ever shown after a team
 * leader decision; the system never sets it on its own.
 */
export function AndonBadge({ state }: { state: keyof typeof ANDON }) {
  const a = ANDON[state];
  return (
    <Badge tone={a.tone} icon={<Icon name={a.icon} weight={a.weight} />}>
      {a.label}
    </Badge>
  );
}

const LOOPS: Record<Loop, { letter: string; label: string }> = {
  shift: { letter: "S", label: "Shift loop" },
  kaizen: { letter: "K", label: "Kaizen loop" },
  launch: { letter: "L", label: "Launch loop" },
};

/** Loop marker: neutral letter tag, never a signal colour. */
export function LoopBadge({ loop }: { loop: Loop }) {
  return <span className={`loop loop--${loop}`}>{LOOPS[loop].label}</span>;
}
