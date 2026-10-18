/**
 * What one camera crop's score means on the line. The model only flags: an alert goes to
 * the operator, who confirms or rejects it, and the team leader decides. Nothing here
 * changes station state.
 */

export interface CropAssessment {
  flagged: boolean;
  /** score divided by the seam threshold */
  ratio: number;
  headline: string;
  nextStep: string;
}

export function assessCrop(score: number, threshold: number): CropAssessment {
  const ratio = threshold > 0 ? score / threshold : 0;
  if (score > threshold) {
    return {
      flagged: true,
      ratio,
      headline: "Above threshold: alert to the operator",
      nextStep: "The operator confirms or rejects it with a reason. The team leader decides; the line never stops on its own.",
    };
  }
  return {
    flagged: false,
    ratio,
    headline: "Below threshold: no alert",
    nextStep: "Leak-critical seams keep the manual check in the standard, whatever the score.",
  };
}

/** Heatmap value -> overlay opacity 0..1, scaled to the seam threshold so colour means the same on every seam. */
export function heatOpacity(value: number, threshold: number): number {
  if (threshold <= 0) return 0;
  return Math.min(1, Math.max(0, (value - 0.5 * threshold) / (0.8 * threshold)));
}
