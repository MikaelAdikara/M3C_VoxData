import { describe, expect, it } from "vitest";

import { AUTONOMY_RULE, getAutonomyState, isWithinWindow, netPressureStep, planCorrection } from "@/lib/rules/autonomy";
import { correctionFor } from "@/lib/corrections/standard";
import type { AutonomySwitch, Correction, Shift } from "@/lib/types";

const shift: Shift = {
  id: "shift-a",
  label: "A",
  startsAt: "2027-04-14T07:00:00.000+07:00",
  endsAt: "2027-04-14T15:30:00.000+07:00",
};

function approved(n: number, overrides: Partial<Correction> = {}): Correction {
  const at = new Date(Date.parse("2027-03-01T09:00:00.000+07:00") + n * 86_400_000).toISOString();
  return {
    id: `c-${n}`, stationId: "st-04", correctionType: "pressure_step", defectTypeId: "BEAD_THIN", alertId: null,
    stepPercent: 2, mode: "propose", status: "approved", createdAt: at,
    decidedBy: "role:team_leader@body", decidedAt: at, ...overrides,
  };
}

const approvals = (count: number) => Array.from({ length: count }, (_, n) => approved(n));

function sw(state: "off" | "on", minute: number): AutonomySwitch {
  return { id: `s-${state}-${minute}`, stationId: "st-04", correctionType: "pressure_step", state, actor: "role:team_leader@body", createdAt: `2027-04-14T10:${String(minute).padStart(2, "0")}:00.000+07:00` };
}

describe("earned autonomy: unlock rule", () => {
  it("is set by the team at 20 approvals and 0 reversals", () => {
    expect(AUTONOMY_RULE).toEqual({ minApprovals: 20, maxReversals: 0 });
  });

  it("stays at propose with 19 approvals and unlocks at the 20th", () => {
    expect(getAutonomyState(approvals(19), [], "st-04", "pressure_step")).toMatchObject({ approvals: 19, unlocked: false, level: "propose", unlockedAt: null });
    const twenty = approvals(20);
    expect(getAutonomyState(twenty, [], "st-04", "pressure_step")).toMatchObject({ approvals: 20, unlocked: true, level: "auto", unlockedAt: twenty[19].decidedAt });
  });

  it("never unlocks with a reversal, however many approvals", () => {
    const list = [...approvals(30), approved(31, { status: "reversed", reversedAt: "2027-04-14T09:00:00.000+07:00", reversedBy: "role:team_leader@body" })];
    const state = getAutonomyState(list, [], "st-04", "pressure_step");
    expect(state).toMatchObject({ approvals: 31, reversals: 1, unlocked: false, level: "propose" });
  });

  it("drops back to propose when an auto execution is reversed", () => {
    const list = [...approvals(20), approved(21, { mode: "auto", status: "reversed", decidedAt: undefined, decidedBy: undefined, reversedAt: "2027-04-14T09:10:00.000+07:00", reversedBy: "role:team_leader@body" })];
    expect(getAutonomyState(list, [], "st-04", "pressure_step")).toMatchObject({ approvals: 20, reversals: 1, autoExecutions: 1, level: "propose" });
  });

  it("does not count rejections, proposals, other stations or other correction types", () => {
    const list = [
      ...approvals(19),
      approved(40, { status: "rejected" }),
      approved(41, { status: "proposed", decidedAt: undefined, decidedBy: undefined }),
      approved(42, { stationId: "st-02" }),
      approved(43, { correctionType: "nozzle_purge", stepPercent: undefined }),
    ];
    expect(getAutonomyState(list, [], "st-04", "pressure_step")).toMatchObject({ approvals: 19, unlocked: false });
  });
});

describe("earned autonomy: switch-off rule", () => {
  it("one switch-off returns the type to propose while the rule stays met", () => {
    const state = getAutonomyState(approvals(20), [sw("off", 1)], "st-04", "pressure_step");
    expect(state).toMatchObject({ unlocked: true, switchedOff: true, level: "propose" });
    expect(state.lastSwitch?.state).toBe("off");
  });

  it("the latest switch wins, and switching on never bypasses the rule", () => {
    expect(getAutonomyState(approvals(20), [sw("off", 1), sw("on", 2)], "st-04", "pressure_step").level).toBe("auto");
    expect(getAutonomyState(approvals(20), [sw("on", 2), sw("off", 3)], "st-04", "pressure_step").level).toBe("propose");
    expect(getAutonomyState(approvals(5), [sw("on", 2)], "st-04", "pressure_step").level).toBe("propose");
  });
});

describe("bounded correction routing", () => {
  const base = { stationId: "st-04", switches: [] as AutonomySwitch[], shift };

  it("proposes only corrections listed in the standardized work", () => {
    expect(correctionFor("st-04", "BEAD_BREAK")?.spec.type).toBe("nozzle_purge");
    expect(correctionFor("st-04", "BEAD_THIN")).toMatchObject({ stepPercent: 2 });
    expect(correctionFor("st-04", "BEAD_EXCESS")).toMatchObject({ stepPercent: -2 });
    expect(planCorrection({ ...base, defectTypeId: "BEAD_OFFSET", corrections: [] })).toEqual({ correctionType: null, mode: "engineer", escalationReason: "not_in_standard" });
    expect(correctionFor("paint-bm", "BEAD_THIN")).toBeNull();
  });

  it("goes to the team leader until autonomy is earned, then runs within the window", () => {
    expect(planCorrection({ ...base, defectTypeId: "BEAD_THIN", corrections: approvals(19) }).mode).toBe("propose");
    expect(planCorrection({ ...base, defectTypeId: "BEAD_THIN", corrections: approvals(20) }).mode).toBe("auto");
    expect(planCorrection({ ...base, defectTypeId: "BEAD_THIN", corrections: approvals(20), switches: [sw("off", 1)] }).mode).toBe("propose");
  });

  it("sends anything outside the window to the engineer, even with autonomy earned", () => {
    const inShift = (n: number, step: number): Correction => approved(100 + n, { stepPercent: step, createdAt: `2027-04-14T08:0${n}:00.000+07:00`, decidedAt: `2027-04-14T08:0${n}:30.000+07:00` });
    const thisShift = [inShift(1, 2), inShift(2, 2)];
    expect(netPressureStep(thisShift, "st-04", shift)).toBe(4);
    expect(isWithinWindow("pressure_step", 4, 2)).toBe(false);
    expect(isWithinWindow("pressure_step", 4, -2)).toBe(true);
    expect(planCorrection({ ...base, defectTypeId: "BEAD_THIN", corrections: [...approvals(20), ...thisShift] })).toMatchObject({ mode: "engineer", escalationReason: "outside_window" });
    // Reversed steps no longer count toward the window; past shifts never do.
    const reversed = [...approvals(20), { ...inShift(1, 2), status: "reversed" as const }, inShift(2, 2)];
    expect(netPressureStep(reversed, "st-04", shift)).toBe(2);
    expect(isWithinWindow("nozzle_purge", 99, 99)).toBe(true);
  });
});
