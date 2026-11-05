import type { CorrectionTypeId, DefectTypeId } from "@/lib/types";

/**
 * Corrections a station's standardized work allows (simulated values). The system may
 * only propose from this list; anything else, or a step beyond the window, goes to the
 * engineer. The robot's own routine runs a correction; the app never writes to line control.
 */
export interface CorrectionSpec {
  type: CorrectionTypeId;
  label: string;
  /** Defects this correction answers, and the direction of a pressure step. */
  answers: Partial<Record<DefectTypeId, 1 | -1 | 0>>;
  /** Pressure step only: size of one step and the allowed band around the standard setpoint, per shift. */
  stepPercent?: number;
  windowPercent?: number;
}

export interface StationStandard {
  stationId: string;
  reference: string;
  corrections: CorrectionSpec[];
}

export const CORRECTION_SPECS: CorrectionSpec[] = [
  {
    type: "nozzle_purge",
    label: "Nozzle purge cycle",
    answers: { BEAD_BREAK: 0, BEAD_MISSING: 0 },
  },
  {
    type: "pressure_step",
    label: "Sealer pressure step",
    answers: { BEAD_THIN: 1, BEAD_EXCESS: -1 },
    stepPercent: 2,
    windowPercent: 5,
  },
];

const STATIONS_WITH_STANDARD = ["st-01", "st-02", "st-03", "st-04", "st-05", "st-06"];

export function stationStandard(stationId: string): StationStandard | null {
  if (!STATIONS_WITH_STANDARD.includes(stationId)) return null;
  return { stationId, reference: `Standardized work ${stationId}, corrections table (simulated)`, corrections: CORRECTION_SPECS };
}

export function correctionSpec(type: CorrectionTypeId): CorrectionSpec {
  return CORRECTION_SPECS.find((spec) => spec.type === type)!;
}

/** The correction the standard lists for a defect, with its signed step, or null when none is listed. */
export function correctionFor(stationId: string, defectTypeId: DefectTypeId): { spec: CorrectionSpec; stepPercent?: number } | null {
  const standard = stationStandard(stationId);
  const spec = standard?.corrections.find((item) => item.answers[defectTypeId] !== undefined);
  if (!spec) return null;
  const direction = spec.answers[defectTypeId]!;
  return spec.stepPercent ? { spec, stepPercent: direction * spec.stepPercent } : { spec };
}

export function correctionLabel(type: CorrectionTypeId | null, stepPercent?: number): string {
  if (!type) return "No correction in the standardized work";
  const spec = correctionSpec(type);
  return stepPercent === undefined ? spec.label : `${spec.label} ${stepPercent > 0 ? "+" : "−"}${Math.abs(stepPercent)}%`;
}
