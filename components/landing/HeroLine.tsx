"use client";

import { LineStage } from "@/components/line/LineStage";
import type { LineView } from "@/lib/types";

/** The K2-Body scale model behind the cover headline. Not interactive. */
export function HeroLine({ line }: { line: LineView }) {
  return <LineStage line={line} selected={null} onSelect={() => {}} variant="hero" />;
}
