import type { DefectTypeId, StandardStepType, StepNotDoneReason } from "@/lib/types";

/**
 * Standard steps (simulated). A machine may make only a correction already written into a
 * revised standard, and in this prototype a person always carries it out on the robot panel.
 *
 * A carded step is shown only while its source card is validated. A step that no card
 * covers (a sealer pressure change) is never offered as a tap: it shows as "ask the engineer".
 */
export interface CardedStep {
  stepType: StandardStepType;
  stationId: string;
  defectTypeIds: DefectTypeId[];
  /** The validated card the step is written in. */
  cardId: string;
  label: string;
  instruction: string;
}

export const CARDED_STEPS: CardedStep[] = [
  {
    stepType: "nozzle_purge",
    stationId: "st-04",
    defectTypeIds: ["BEAD_THIN"],
    cardId: "KC-SEAL-014",
    label: "Nozzle purge, 30 s",
    instruction: "Run the 30 s nozzle purge from the robot panel, then watch the next body.",
  },
  {
    stepType: "nozzle_purge",
    stationId: "st-05",
    defectTypeIds: ["BEAD_MISSING"],
    cardId: "KC-SEAL-042",
    label: "Nozzle purge until flow is continuous",
    instruction: "Purge from the robot panel until the flow is continuous, then check the first bead.",
  },
];

/** Defects where a pressure change might help; no revised standard covers it, so the engineer decides. */
export const ASK_ENGINEER_DEFECTS: DefectTypeId[] = ["BEAD_THIN", "BEAD_EXCESS"];

export const ASK_ENGINEER_STEP = {
  stepType: "pressure_change" as const,
  label: "Sealer pressure change",
  instruction: "Not in the standard. Ask the engineer; do not change the pressure on the line.",
};

export const NOT_DONE_REASONS: { value: StepNotDoneReason; label: string }[] = [
  { value: "line_running", label: "Could not stop for it" },
  { value: "material_unavailable", label: "Purge material not ready" },
  { value: "robot_fault", label: "Robot panel fault" },
  { value: "other", label: "Other" },
];

export function isNotDoneReason(value: unknown): value is StepNotDoneReason {
  return NOT_DONE_REASONS.some((item) => item.value === value);
}

export function cardedStepFor(stationId: string, defectTypeId: DefectTypeId): CardedStep | undefined {
  return CARDED_STEPS.find((step) => step.stationId === stationId && step.defectTypeIds.includes(defectTypeId));
}

export function stepLabel(step: { stepType: StandardStepType; stationId: string; defectTypeId: DefectTypeId; inStandard: boolean }): string {
  if (!step.inStandard) return ASK_ENGINEER_STEP.label;
  return cardedStepFor(step.stationId, step.defectTypeId)?.label ?? "Nozzle purge";
}
