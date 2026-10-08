import { beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ role: "operator" as string }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(() => ({ value: context.role })) })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { confirmAlert, rejectAlert } from "@/lib/actions/alerts";
import { updateA3, advanceTicket, requestValidation } from "@/lib/actions/kaizen";
import { validateCard } from "@/lib/actions/knowledge";
import { decideShift, restartLine, verifyRejection } from "@/lib/actions/shift";
import { advanceSimulatedProduction, injectFalseAlarm, injectRepeat3, injectTrueDefect, resetDemo } from "@/lib/actions/simulator";
import { answerAssistantQuestion } from "@/lib/assistant/service";
import { getCameraView, getLineView, getShiftBoardView, getSimulatorView, getStationView, getTicketView } from "@/lib/queries";
import { getMemoryStore, resetMemoryStore } from "@/lib/store/memory";

describe("isolated complete demo workflow", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    context.role = "operator";
    await resetMemoryStore();
  });

  it("keeps camera, decisions, production, Kaizen and cited knowledge coherent", async () => {
    const initial = await getSimulatorView();
    expect(initial.isCanonicalReset).toBe(true);
    expect((await getStationView("st-04"))?.openAlert).toBeNull();
    expect((await getCameraView()).cameras.find((c) => c.stationId === "st-06")).toMatchObject({ state: "offline", openAlertIds: [] });
    expect((await getCameraView()).events).toContainEqual(expect.objectContaining({ kind: "gap", cameraId: "body-edge-06/cam-01" }));

    expect(await injectTrueDefect()).toEqual({ ok: true });
    expect((await getStationView("st-04"))?.openAlert).toMatchObject({ id: "alert-st04-open-001", anomalyScore: 0.83, threshold: 0.61 });
    expect(await confirmAlert("alert-st04-open-001")).toEqual({ ok: true });
    expect((await getShiftBoardView()).pendingDecisions.map((a) => a.id)).toContain("alert-st04-open-001");
    expect(await decideShift("alert-st04-open-001", "stop_fix", "Nozzle check")).toMatchObject({ ok: false });
    context.role = "team_leader";
    expect(await decideShift("alert-st04-open-001", "stop_fix", "Nozzle check")).toEqual({ ok: true });
    expect(await decideShift("alert-st04-open-001", "stop_fix", "Retry")).toMatchObject({ ok: false });
    expect((await getShiftBoardView()).pendingDecisions.map((a) => a.id)).not.toContain("alert-st04-open-001");
    const stopped = await getLineView();
    expect(stopped.line.state).toBe("stopped");
    expect(await advanceSimulatedProduction(stopped.line.bodiesCompleted)).toMatchObject({ ok: false });
    expect((await getLineView()).line.bodiesCompleted).toBe(stopped.line.bodiesCompleted);
    expect(await restartLine("Nozzle repaired; bead rechecked")).toEqual({ ok: true });
    expect((await getLineView()).line.state).toBe("running");

    expect(await injectFalseAlarm()).toEqual({ ok: true });
    context.role = "operator";
    expect(await rejectAlert("alert-st02-reflection-demo", "reflection")).toEqual({ ok: true });
    expect((await getStationView("st-02"))?.decisionHistory[0].operatorDecision.reasonCode).toBe("reflection");
    context.role = "team_leader";
    expect(await verifyRejection("review-st02-current")).toEqual({ ok: true });
    expect((await getShiftBoardView()).modelReviews.find((r) => r.id === "review-st02-current")?.eligibleForModelUpdate).toBe(true);

    expect((await Promise.all(Array.from({ length: 4 }, () => injectRepeat3()))).every((result) => result.ok)).toBe(true);
    const tickets = (await getMemoryStore().getSnapshot()).tickets.filter((t) => t.stationId === "st-04" && t.defectTypeId === "BEAD_EXCESS" && t.status === "open");
    expect(tickets).toHaveLength(1);
    expect(tickets[0].triggerAlertIds).toEqual(["alert-sim-repeat-excess-1", "alert-sim-repeat-excess-2", "alert-sim-repeat-excess-3"]);
    context.role = "engineer";
    expect(await advanceTicket(tickets[0].id)).toEqual({ ok: true });
    expect(await updateA3(tickets[0].id, {
      rootCause: "Flow setpoint remains high at the corner.",
      countermeasure: "Pair corner speed with approved flow.",
      check: "Trial body meets bead profile.",
      standardise: "Revise corner flow recipe.",
    })).toEqual({ ok: true });
    expect(await advanceTicket(tickets[0].id)).toEqual({ ok: true });
    expect((await getTicketView(tickets[0].id))?.validation.canRequest).toBe(true);
    expect(await requestValidation(tickets[0].id)).toEqual({ ok: true });
    const draftId = (await getTicketView(tickets[0].id))?.validation.draftCardId;
    expect(draftId).toBeTruthy();
    context.role = "senior_expert";
    expect(await validateCard(draftId!)).toEqual({ ok: true });
    const cards = (await getMemoryStore().getSnapshot()).cards;
    const answer = await answerAssistantQuestion("Excess sealer at a corner transition?", cards);
    expect(answer.mode).not.toBe("no_card");
    expect(answer.citations.every((c) => cards.some((card) => card.id === c.cardId && card.revision === c.revision && card.status === "validated"))).toBe(true);
    expect((await answerAssistantQuestion("How do we fix paint orange peel?", cards)).mode).toBe("no_card");

    expect(await resetDemo()).toEqual({ ok: true });
    expect((await getSimulatorView()).currentFingerprint).toBe(initial.seedFingerprint);
  });

  it("serializes repeated operator and team-leader clicks without duplicate decisions", async () => {
    await injectTrueDefect();
    const confirms = await Promise.all(Array.from({ length: 4 }, () => confirmAlert("alert-st04-open-001")));
    expect(confirms.filter((result) => result.ok)).toHaveLength(1);
    context.role = "team_leader";
    const decisions = await Promise.all(Array.from({ length: 4 }, () => decideShift("alert-st04-open-001", "contain", "Inspect last bodies")));
    expect(decisions.filter((result) => result.ok)).toHaveLength(1);
    const snapshot = await getMemoryStore().getSnapshot();
    expect(snapshot.decisions.filter((decision) => decision.alertId === "alert-st04-open-001" && decision.kind === "confirm")).toHaveLength(1);
    expect(snapshot.decisions.filter((decision) => decision.alertId === "alert-st04-open-001" && decision.kind === "contain")).toHaveLength(1);
  });
});
