import { beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ role: "operator" as string }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(() => ({ value: context.role })) })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { confirmAlert } from "@/lib/actions/alerts";
import { closeWorkOrder, injectRobotErrors, submitWalkCheck } from "@/lib/actions/signals";
import { injectRepeat3, injectTrueDefect, resetDemo } from "@/lib/actions/simulator";
import { injectStepRepeat, markStepDone, markStepNotDone } from "@/lib/actions/standard-steps";
import { buildEvents } from "@/lib/events/outbox";
import { buildSignalsView, buildStandardStepsView } from "@/lib/learning-layer-views";
import { getKaizenView, getStationView, getTicketView } from "@/lib/queries";
import { createSeedData } from "@/lib/seed";
import { getMemoryStore, resetMemoryStore } from "@/lib/store/memory";

const snapshot = () => getMemoryStore().getSnapshot();

describe("learning layer actions", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.WORKFLOW_WEBHOOK_URL;
    context.role = "operator";
    await resetMemoryStore();
  });

  it("robot: the demo report that lifts E-2210 over the weekly Pareto rule opens one maintenance ticket", async () => {
    expect(await injectRobotErrors(1)).toEqual({ ok: true });
    const kaizen = await getKaizenView();
    const robotTickets = kaizen.tickets.filter((t) => t.source === "robot_error");
    expect(robotTickets).toHaveLength(1);
    expect(robotTickets[0]).toMatchObject({ stationId: "st-04", defectType: null, ownerRole: "role:maintenance@body" });
    const view = await getTicketView(robotTickets[0].id);
    expect(view?.triggerSignals).toHaveLength(5);
    expect(view?.a3.background).toMatch(/before any breakdown/);
    expect(buildSignalsView(await snapshot()).pareto.rows.find((r) => r.code === "E-2210")).toMatchObject({ rising: true, ticketId: robotTickets[0].id });

    expect(await injectRobotErrors(2)).toEqual({ ok: true });
    expect((await getKaizenView()).tickets.filter((t) => t.source === "robot_error")).toHaveLength(1);
  });

  it("walk-check: log, close the work order, log the same finding again, and a maintenance ticket opens", async () => {
    context.role = "engineer";
    expect(await submitWalkCheck({ equipmentId: "st-04/robot-2", symptom: "noise" })).toMatchObject({ ok: false });
    context.role = "operator";
    expect(await submitWalkCheck({ equipmentId: "nope", symptom: "noise" })).toMatchObject({ ok: false });
    expect(await submitWalkCheck({ equipmentId: "st-04/robot-2", symptom: "smoke" })).toMatchObject({ ok: false });

    expect(await submitWalkCheck({ equipmentId: "st-04/robot-2", symptom: "noise", photoAttached: true, note: "squeal at the wrist" })).toEqual({ ok: true });
    let state = await snapshot();
    const order = state.workOrders.find((o) => o.equipmentId === "st-04/robot-2" && o.status === "open");
    expect(order).toBeDefined();
    expect(state.tickets.some((t) => t.source === "walk_check")).toBe(false);

    expect(await closeWorkOrder(order!.id)).toEqual({ ok: true });
    expect(await closeWorkOrder(order!.id)).toMatchObject({ ok: false });
    expect(await submitWalkCheck({ equipmentId: "st-04/robot-2", symptom: "noise" })).toEqual({ ok: true });

    const ticket = (await getKaizenView()).tickets.find((t) => t.source === "walk_check");
    expect(ticket).toMatchObject({ ownerRole: "role:maintenance@body", subject: expect.stringMatching(/unusual noise on Multifunction robot 2/i) });
    expect((await getTicketView(ticket!.id))?.ticket.returnedAfterWorkOrderId).toBe(order!.id);
    state = await snapshot();
    expect(buildSignalsView(state).workOrders.open.find((o) => o.returnOf === order!.id)?.ticketId).toBe(ticket!.id);
    const events = buildEvents(state);
    expect(events.some((e) => e.type === "work_order.closed" && e.data.work_order_id === order!.id)).toBe(true);
    expect(JSON.stringify(events)).not.toContain("squeal at the wrist");
  });

  it("standard step: the carded purge for the team leader, pressure only as ask-the-engineer, and the repeat still on the ticket", async () => {
    expect(await injectStepRepeat()).toEqual({ ok: true });
    let state = await snapshot();
    const purge = state.standardSteps.find((s) => s.inStandard);
    const ask = state.standardSteps.find((s) => !s.inStandard);
    expect(purge).toMatchObject({ stationId: "st-04", stepType: "nozzle_purge", sourceCardId: "KC-SEAL-014", status: "shown", ticketId: "KZ-SEAL-007" });
    expect(ask).toMatchObject({ stepType: "pressure_change", sourceCardId: null, status: "shown" });
    const repeatsBefore = state.tickets.find((t) => t.id === "KZ-SEAL-007")?.repeatAlertIds ?? [];
    expect(repeatsBefore.length).toBeGreaterThanOrEqual(1);

    expect(await markStepDone(purge!.id)).toMatchObject({ ok: false });
    context.role = "team_leader";
    expect(await markStepDone(ask!.id)).toMatchObject({ ok: false, error: expect.stringMatching(/ask the engineer/i) });
    expect(await markStepDone(purge!.id)).toEqual({ ok: true });
    expect(await markStepDone(purge!.id)).toMatchObject({ ok: false });

    // Done or not, the next repeat is logged on the ticket and the step shows again; the engineer is asked once a shift.
    expect(await injectStepRepeat()).toEqual({ ok: true });
    state = await snapshot();
    expect(state.tickets.find((t) => t.id === "KZ-SEAL-007")?.repeatAlertIds?.length).toBe(repeatsBefore.length + 1);
    const again = state.standardSteps.find((s) => s.inStandard && s.status === "shown");
    expect(again?.sourceCardId).toBe("KC-SEAL-014");
    expect(state.standardSteps.filter((s) => !s.inStandard)).toHaveLength(1);
    expect(await markStepNotDone(again!.id, "because")).toMatchObject({ ok: false });
    expect(await markStepNotDone(again!.id, "robot_fault")).toEqual({ ok: true });

    state = await snapshot();
    const events = buildEvents(state);
    const types = events.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["step.shown", "step.done", "step.not_done", "ticket.repeat_logged"]));
    expect(events.find((e) => e.id === `step.not_done:${again!.id}`)).toMatchObject({ actor: "role:team_leader@body", data: { reason_code: "robot_fault", source_card: "KC-SEAL-014" } });
    expect(events.find((e) => e.id === `step.shown:${ask!.id}`)?.data).toMatchObject({ in_standard: "no", next: "ask_engineer" });
    const view = buildStandardStepsView(state);
    expect(view.waiting).toHaveLength(0);
    expect(view.recent.map((s) => s.status)).toEqual(["not_done", "done"]);
    expect(view.askEngineer[0]).toMatchObject({ label: "Sealer pressure change", sourceCardId: null });
  });

  it("no card for excess sealer: the repeat opens its ticket and the pressure change is only ask-the-engineer", async () => {
    expect(await injectRepeat3()).toEqual({ ok: true });
    const state = await snapshot();
    expect(state.tickets.some((t) => t.stationId === "st-04" && t.defectTypeId === "BEAD_EXCESS" && t.status === "open")).toBe(true);
    const steps = state.standardSteps.filter((s) => s.defectTypeId === "BEAD_EXCESS");
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ inStandard: false, stepType: "pressure_change" });
  });

  it("the guided true defect still behaves the same and shows its body type from the model-detection camera", async () => {
    await injectTrueDefect();
    const alert = (await getStationView("st-04"))?.openAlert;
    expect(alert?.bodyType).toMatchObject({ source: "model_detection_camera", beadModel: expect.stringMatching(/^sealer-st04-v1\.3-[abc]$/) });
    expect(await confirmAlert("alert-st04-open-001")).toEqual({ ok: true });
    expect((await snapshot()).standardSteps).toHaveLength(0);
  });

  it("reset restores the seed exactly", async () => {
    await injectRobotErrors(3);
    await injectStepRepeat();
    expect(await resetDemo()).toEqual({ ok: true });
    expect(await snapshot()).toEqual(createSeedData());
  });
});
