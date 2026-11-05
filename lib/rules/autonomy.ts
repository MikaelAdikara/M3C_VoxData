import { correctionFor, correctionSpec } from "@/lib/corrections/standard";
import { isWithinShift } from "@/lib/rules/repeat";
import type { AutonomySwitch, Correction, CorrectionTypeId, DefectTypeId, Shift } from "@/lib/types";

/**
 * Earned autonomy for bounded corrections. Team-set rule: "auto within window" unlocks
 * for one correction type at one station only after 20 team-leader approvals and no
 * reversal. The team leader can switch it off at any time; anything outside the
 * standardized-work window always goes to the engineer.
 */
export const AUTONOMY_RULE = { minApprovals: 20, maxReversals: 0 } as const;

export type AutonomyLevel = "propose" | "auto";

export interface AutonomyState {
  stationId: string;
  correctionType: CorrectionTypeId;
  approvals: number;
  reversals: number;
  autoExecutions: number;
  unlocked: boolean;
  /** Time of the approval that met the rule, when the rule is met. */
  unlockedAt: string | null;
  switchedOff: boolean;
  lastSwitch: AutonomySwitch | null;
  level: AutonomyLevel;
}

const byTime = <T extends { createdAt: string }>(a: T, b: T) => Date.parse(a.createdAt) - Date.parse(b.createdAt);

/** A team-leader approval, whether or not it was reversed later. */
export function isApproval(c: Correction): boolean {
  return c.mode === "propose" && Boolean(c.decidedAt) && (c.status === "approved" || c.status === "reversed");
}

export function getAutonomyState(
  corrections: readonly Correction[],
  switches: readonly AutonomySwitch[],
  stationId: string,
  correctionType: CorrectionTypeId,
): AutonomyState {
  const mine = corrections.filter((c) => c.stationId === stationId && c.correctionType === correctionType);
  const approvals = mine
    .filter(isApproval)
    .sort((a, b) => Date.parse(a.decidedAt!) - Date.parse(b.decidedAt!));
  const reversals = mine.filter((c) => c.status === "reversed").length;
  const unlocked = approvals.length >= AUTONOMY_RULE.minApprovals && reversals <= AUTONOMY_RULE.maxReversals;
  const lastSwitch =
    [...switches].filter((s) => s.stationId === stationId && s.correctionType === correctionType).sort(byTime).at(-1) ?? null;
  const switchedOff = lastSwitch?.state === "off";
  return {
    stationId,
    correctionType,
    approvals: approvals.length,
    reversals,
    autoExecutions: mine.filter((c) => c.mode === "auto").length,
    unlocked,
    unlockedAt: unlocked ? approvals[AUTONOMY_RULE.minApprovals - 1].decidedAt! : null,
    switchedOff,
    lastSwitch,
    level: unlocked && !switchedOff ? "auto" : "propose",
  };
}

/** Net pressure change this shift at a station: approved and auto steps that were not reversed. */
export function netPressureStep(corrections: readonly Correction[], stationId: string, shift: Shift): number {
  return corrections
    .filter(
      (c) =>
        c.stationId === stationId &&
        c.correctionType === "pressure_step" &&
        (c.status === "approved" || c.status === "auto_executed") &&
        isWithinShift(c.decidedAt ?? c.createdAt, shift),
    )
    .reduce((sum, c) => sum + (c.stepPercent ?? 0), 0);
}

/** True when the step keeps the station inside its standardized-work window. */
export function isWithinWindow(correctionType: CorrectionTypeId, net: number, step = 0): boolean {
  const spec = correctionSpec(correctionType);
  if (spec.windowPercent === undefined) return true;
  return Math.abs(net + step) <= spec.windowPercent;
}

export interface CorrectionPlan {
  correctionType: CorrectionTypeId | null;
  stepPercent?: number;
  mode: Correction["mode"];
  escalationReason?: Correction["escalationReason"];
}

/**
 * What happens to a confirmed repeat: the standard's correction, routed to the team
 * leader (propose), run within the window (auto, earned), or sent to the engineer.
 */
export function planCorrection(input: {
  stationId: string;
  defectTypeId: DefectTypeId;
  corrections: readonly Correction[];
  switches: readonly AutonomySwitch[];
  shift: Shift;
}): CorrectionPlan {
  const found = correctionFor(input.stationId, input.defectTypeId);
  if (!found) return { correctionType: null, mode: "engineer", escalationReason: "not_in_standard" };
  const { spec, stepPercent } = found;
  const net = netPressureStep(input.corrections, input.stationId, input.shift);
  if (!isWithinWindow(spec.type, net, stepPercent ?? 0)) {
    return { correctionType: spec.type, stepPercent, mode: "engineer", escalationReason: "outside_window" };
  }
  const autonomy = getAutonomyState(input.corrections, input.switches, input.stationId, spec.type);
  return { correctionType: spec.type, stepPercent, mode: autonomy.level === "auto" ? "auto" : "propose" };
}
