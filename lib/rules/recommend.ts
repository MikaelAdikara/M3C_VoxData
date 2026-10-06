import type { Criticality, RecommendationView } from "@/lib/types";

export function getShiftRecommendation(
  criticality: Criticality,
  confirmedRepeatCount: number,
): RecommendationView {
  if (criticality === "leak_critical") {
    return {
      decision: "stop_fix",
      text: "Stop and fix: leak-critical; body held for repair",
      suggestedBy: "system",
      confirmedRepeatCount,
    };
  }

  if (confirmedRepeatCount >= 2) {
    return {
      decision: "contain",
      text: "Contain: check the last N bodies at this station",
      suggestedBy: "system",
      confirmedRepeatCount,
    };
  }

  return {
    decision: "continue",
    text: "Continue with check: repair at station, monitor",
    suggestedBy: "system",
    confirmedRepeatCount,
  };
}
