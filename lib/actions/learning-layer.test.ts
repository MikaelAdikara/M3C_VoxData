import { beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ role: "operator" as string }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(() => ({ value: context.role })) })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { confirmAlert } from "@/lib/actions/alerts";
import {
  approveCorrection,
  fastForwardApprovals,
  injectCorrectionRepeat,
  rejectCorrection,
  reverseCorrection,
  setAutonomy,
} from "@/lib/actions/corrections";
import { injectRobotErrors, submitWalkCheck } from "@/lib/actions/signals";
import { injectRepeat3, injectTrueDefect, resetDemo } from "@/lib/actions/simulator";
import { buildEvents } from "@/lib/events/outbox";
import { buildCorrectionsView } from "@/lib/learning-layer-views";
import { getKaizenView, getStationView, getTicketView } from "@/lib/queries";
import { getAutonomyState } from "@/lib/rules/autonomy";
import { createSeedData } from "@/lib/seed";
import { getMemoryStore, resetMemoryStore } from "@/lib/store/memory";

const snapshot = () => getMemoryStore().getSnapshot();
const pending = async () => (await snapshot()).corrections.filter((c) => c.status === "proposed");

describe("learning layer actions", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.WORKFLOW_WEBHOOK_URL;
    context.role = "operator";
    await resetMemoryStore();
  });

  it("robot error codes and walk-checks open tickets in the same Kaizen list", async () => {
    expect(await injectRobotErrors(3)).toEqual({ ok: true });
    let kaizen = await getKaizenView();
    const robotTicket = kaizen.tickets.find((t) => t.source === "robot_error");
    expect(robotTicket).toMatchObject({ stationId: "st-04", defectType: null });
    const view = await getTicketView(robotTicket!.id);
    expect(view?.triggerSignals).toHaveLength(3);
    expect(view?.a3.background).toMatch(/before any breakdown/);

    context.role = "engineer";
    expect(await submitWalkCheck({ equipmentId: "st-04/pump", symptom: "leak" })).toMatchObject({ ok: false });
    context.role = "operator";
    expect(await submitWalkCheck({ equipmentId: "nope", symptom: "leak" })).toMatchObject({ ok: false });
    expect(await submitWalkCheck({ equipmentId: "st-04/pump", symptom: "smoke" })).toMatchObject({ ok: false });
    for (let n = 0; n < 3; n += 1) {
      expect(await submitWalkCheck({ equipmentId: "st-04/pump", symptom: "leak", photoAttached: n === 0, note: "drip under the pump" })).toEqual({ ok: true });
    }
    kaizen = await getKaizenView();
    expect(kaizen.tickets.find((t) => t.source === "walk_check")?.subject).toMatch(/leak on Sealer pump unit/i);
    const events = buildEvents(await snapshot());
    expect(events.filter((e) => e.type === "ticket.opened" && e.data.signal_source !== "bead")).toHaveLength(2);
    expect(JSON.stringify(events)).not.toContain("drip under the pump");
  });

  it("a confirmed repeat proposes a standardized correction that only the team leader decides", async () => {
    expect(await injectRepeat3()).toEqual({ ok: true });
    const [proposal] = await pending();
    expect(proposal).toMatchObject({ stationId: "st-04", correctionType: "pressure_step", stepPercent: -2, mode: "propose", alertId: "alert-sim-repeat-excess-2" });

    expect(await approveCorrection(proposal.id)).toMatchObject({ ok: false });
    context.role = "team_leader";
    expect(await rejectCorrection(proposal.id)).toEqual({ ok: true });
    expect(await approveCorrection(proposal.id)).toMatchObject({ ok: false });
    const types = buildEvents(await snapshot()).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["correction.proposed", "correction.rejected"]));
  });

  it("the guided true defect still behaves the same and shows its body type from the model-detection camera", async () => {
    await injectTrueDefect();
    const alert = (await getStationView("st-04"))?.openAlert;
    expect(alert?.bodyType).toMatchObject({ source: "model_detection_camera", beadModel: expect.stringMatching(/^sealer-st04-v1\.3-[abc]$/) });
    expect(await confirmAlert("alert-st04-open-001")).toEqual({ ok: true });
    expect((await snapshot()).corrections).toHaveLength(0);
  });

  it("fast-forward, approve to unlock, auto within window, then the engineer past the window; switch-off and reversal are one tap", async () => {
    expect(await fastForwardApprovals()).toEqual({ ok: true });
    let state = await snapshot();
    expect(getAutonomyState(state.corrections, state.autonomySwitches, "st-04", "pressure_step")).toMatchObject({ approvals: 19, level: "propose" });
    const [demoProposal] = await pending();
    expect(demoProposal).toMatchObject({ fastForward: true, stepPercent: 2 });

    context.role = "team_leader";
    expect(await approveCorrection(demoProposal.id)).toEqual({ ok: true });
    state = await snapshot();
    expect(getAutonomyState(state.corrections, state.autonomySwitches, "st-04", "pressure_step")).toMatchObject({ approvals: 20, unlocked: true, level: "auto" });
    expect(buildEvents(state).some((e) => e.type === "autonomy.unlocked")).toBe(true);

    // Net +2% so far; the next thin-bead repeat runs +2% on its own (net +4%, window ±5%).
    expect(await injectCorrectionRepeat()).toEqual({ ok: true });
    state = await snapshot();
    const auto = state.corrections.find((c) => c.mode === "auto");
    expect(auto).toMatchObject({ status: "auto_executed", stepPercent: 2 });
    expect(buildEvents(state).find((e) => e.id === `correction.auto_executed:${auto!.id}`)?.data).toMatchObject({ notify: "team_leader" });

    // The next would make +6%: outside the window, so it goes to the engineer even in auto.
    expect(await injectCorrectionRepeat()).toEqual({ ok: true });
    state = await snapshot();
    expect(state.corrections.find((c) => c.mode === "engineer")).toMatchObject({ status: "escalated", escalationReason: "outside_window" });

    // Switch-off is one tap and logged; then proposals come back to the team leader.
    expect(await setAutonomy("st-04", "pressure_step", "off")).toEqual({ ok: true });
    expect(await setAutonomy("st-04", "pressure_step", "off")).toMatchObject({ ok: false });
    state = await snapshot();
    expect(getAutonomyState(state.corrections, state.autonomySwitches, "st-04", "pressure_step").level).toBe("propose");
    expect(buildEvents(state).some((e) => e.type === "autonomy.switched_off" && e.actor === "role:team_leader@body")).toBe(true);
    expect(await setAutonomy("st-04", "pressure_step", "on")).toEqual({ ok: true });

    // A reversal locks auto for this correction type.
    expect(await reverseCorrection(auto!.id)).toEqual({ ok: true });
    state = await snapshot();
    expect(getAutonomyState(state.corrections, state.autonomySwitches, "st-04", "pressure_step")).toMatchObject({ reversals: 1, unlocked: false, level: "propose" });
    expect(buildEvents(state).some((e) => e.type === "correction.reversed")).toBe(true);
    expect(await fastForwardApprovals()).toMatchObject({ ok: false });
    const view = buildCorrectionsView(state);
    expect(view.ladders.find((l) => l.correctionType === "pressure_step")).toMatchObject({ reversals: 1, level: "propose" });
  });

  it("reset restores the seed exactly", async () => {
    await injectRobotErrors(3);
    await fastForwardApprovals();
    expect(await resetDemo()).toEqual({ ok: true });
    expect(await snapshot()).toEqual(createSeedData());
  });
});
