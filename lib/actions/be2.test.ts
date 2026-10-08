import { beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({
  role: "operator" as string | undefined,
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => (context.role ? { value: context.role } : undefined)),
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: context.revalidatePath }));

import { confirmAlert } from "@/lib/actions/alerts";
import { reviseReturnedCard, routeToOwner, returnCard, validateCard } from "@/lib/actions/knowledge";
import { advanceTicket, requestValidation, updateA3 } from "@/lib/actions/kaizen";
import { verifyRejection } from "@/lib/actions/shift";
import { injectTrueDefect } from "@/lib/actions/simulator";
import { getKnowledgeView, getShiftBoardView, getStationView, getTicketView } from "@/lib/queries";
import { getMemoryStore, resetMemoryStore } from "@/lib/store/memory";
import type { A3, Alert } from "@/lib/types";

const completeA3: A3 = {
  background: "Three confirmed repeats at st-02.",
  currentCondition: "Offset bead repeats in shift A.",
  rootCause: "Path check is missing after changeover.",
  countermeasure: "Add a path check after changeover.",
  check: "Trial bodies meet the bead path standard.",
  standardise: "Revise the sealer changeover checklist.",
};

function repeatAlert(id: string, minute: number, status: Alert["status"] = "confirmed"): Alert {
  return {
    id,
    stationId: "st-04",
    bodyId: `body-${id}`,
    roi: "seam-R-door-07",
    defectTypeId: "BEAD_BREAK",
    anomalyScore: 0.8,
    threshold: 0.61,
    modelVersion: "test",
    image: "illustration.svg",
    mask: "mask.svg",
    createdAt: `2027-03-14T08:${String(minute).padStart(2, "0")}:00.000+07:00`,
    status,
  };
}

describe("BE-2 Kaizen actions", () => {
  beforeEach(async () => {
    context.role = "operator";
    context.revalidatePath.mockReset();
    await resetMemoryStore();
  });

  it("atomically opens one ticket when operator confirmation reaches repeat three", async () => {
    await injectTrueDefect();
    await getMemoryStore().mutate((draft) => {
      draft.alerts.push(repeatAlert("repeat-a", 10), repeatAlert("repeat-b", 20));
    });
    await expect(confirmAlert("alert-st04-open-001")).resolves.toEqual({ ok: true });
    const opened = (await getMemoryStore().getSnapshot()).tickets.filter(
      (ticket) =>
        ticket.stationId === "st-04" &&
        ticket.defectTypeId === "BEAD_BREAK" &&
        ticket.status === "open",
    );
    expect(opened).toHaveLength(1);
    expect(opened[0].triggerAlertIds).toEqual(["repeat-a", "repeat-b", "alert-st04-open-001"]);
    expect(opened[0].aiPrefilledFields).toEqual(["background", "currentCondition"]);

    await getMemoryStore().mutate((draft) => draft.alerts.push(repeatAlert("repeat-d", 50, "open")));
    await expect(confirmAlert("repeat-d")).resolves.toEqual({ ok: true });
    const afterFourth = (await getMemoryStore().getSnapshot()).tickets.filter(
      (ticket) => ticket.stationId === "st-04" && ticket.defectTypeId === "BEAD_BREAK" && ticket.status === "open",
    );
    expect(afterFourth).toHaveLength(1);
  });

  it("allows the engineer to update A3 and removes human-edited fields from AI-prefill labels", async () => {
    context.role = "engineer";
    await expect(updateA3("KZ-SEAL-007", { background: "Engineer-checked background" })).resolves.toEqual({ ok: true });
    const view = await getTicketView("KZ-SEAL-007");
    expect(view?.a3.background).toBe("Engineer-checked background");
    expect(view?.aiPrefilledFields).not.toContain("background");
  });

  it("rejects invalid tickets and non-engineer A3 updates", async () => {
    await expect(updateA3("KZ-SEAL-007", { rootCause: "Cause" })).resolves.toMatchObject({ ok: false });
    context.role = "engineer";
    await expect(updateA3("missing-ticket", { rootCause: "Cause" })).resolves.toEqual({
      ok: false,
      error: "Kaizen ticket not found.",
    });
  });

  it("enforces allowed status transitions", async () => {
    context.role = "engineer";
    await expect(advanceTicket("KZ-SEAL-007")).resolves.toMatchObject({ ok: false });
    await updateA3("KZ-SEAL-007", completeA3);
    await expect(advanceTicket("KZ-SEAL-007")).resolves.toEqual({ ok: true });
    expect((await getTicketView("KZ-SEAL-007"))?.ticket.status).toBe("countermeasure_trial");
    await expect(advanceTicket("KZ-SEAL-007")).resolves.toMatchObject({ ok: false });
  });

  it("creates one draft card only after a complete countermeasure trial", async () => {
    context.role = "engineer";
    await expect(requestValidation("KZ-SEAL-008")).resolves.toMatchObject({ ok: false });
    await updateA3("KZ-SEAL-008", completeA3);
    await expect(requestValidation("KZ-SEAL-008")).resolves.toEqual({ ok: true });
    const snapshot = await getMemoryStore().getSnapshot();
    const draft = snapshot.cards.find((card) => card.sourceTicketId === "KZ-SEAL-008");
    expect(draft).toMatchObject({ status: "draft", revision: 1 });
    await expect(requestValidation("KZ-SEAL-008")).resolves.toMatchObject({ ok: false });
  });

  it("requires senior validation before the engineer can close the source ticket", async () => {
    context.role = "engineer";
    await updateA3("KZ-SEAL-008", completeA3);
    await requestValidation("KZ-SEAL-008");
    const draft = (await getMemoryStore().getSnapshot()).cards.find(
      (card) => card.sourceTicketId === "KZ-SEAL-008" && card.status === "draft",
    );
    expect(draft).toBeDefined();
    context.role = "senior_expert";
    await expect(validateCard(draft!.id)).resolves.toEqual({ ok: true });
    expect((await getTicketView("KZ-SEAL-008"))?.ticket.status).toBe("validated");
    context.role = "engineer";
    await expect(advanceTicket("KZ-SEAL-008")).resolves.toEqual({ ok: true });
    expect((await getTicketView("KZ-SEAL-008"))?.ticket.status).toBe("closed");
  });

  it("requires an A3 revision after return, then creates a new draft revision", async () => {
    context.role = "engineer";
    await updateA3("KZ-SEAL-008", completeA3);
    expect(await requestValidation("KZ-SEAL-008")).toEqual({ ok: true });
    const first = (await getMemoryStore().getSnapshot()).cards.find((card) => card.sourceTicketId === "KZ-SEAL-008")!;
    context.role = "senior_expert";
    expect(await returnCard(first.id, "Add a pressure check.")).toEqual({ ok: true });
    expect(await validateCard(first.id)).toMatchObject({ ok: false });
    context.role = "engineer";
    expect((await getTicketView("KZ-SEAL-008"))?.validation).toMatchObject({
      draftCardId: null,
      returnedCardId: first.id,
      canRequest: false,
    });
    expect(await requestValidation("KZ-SEAL-008")).toMatchObject({ ok: false });
    await updateA3("KZ-SEAL-008", { check: "Pressure held within the trial range." });
    expect((await getTicketView("KZ-SEAL-008"))?.validation.canRequest).toBe(true);
    expect(await requestValidation("KZ-SEAL-008")).toEqual({ ok: true });
    const revisions = (await getMemoryStore().getSnapshot()).cards.filter((card) => card.id === first.id);
    expect(revisions.map((card) => [card.revision, Boolean(card.returnedAt)])).toEqual([[1, true], [2, false]]);
    context.role = "senior_expert";
    expect(await validateCard(first.id)).toEqual({ ok: true });
    expect((await getTicketView("KZ-SEAL-008"))?.ticket.status).toBe("validated");
  });
});

describe("BE-2 knowledge actions", () => {
  beforeEach(async () => {
    context.role = "operator";
    context.revalidatePath.mockReset();
    await resetMemoryStore();
  });

  it("lets only the senior expert validate a draft into a new auditable revision", async () => {
    await expect(validateCard("KC-SEAL-030")).resolves.toMatchObject({ ok: false });
    context.role = "senior_expert";
    await expect(validateCard("KC-SEAL-030")).resolves.toEqual({ ok: true });
    const revisions = (await getMemoryStore().getSnapshot()).cards.filter((card) => card.id === "KC-SEAL-030");
    expect(revisions.map((card) => [card.revision, card.status])).toEqual([
      [1, "draft"],
      [2, "validated"],
    ]);
    const view = await getKnowledgeView({ status: "validated" });
    expect(view.cards.find((card) => card.id === "KC-SEAL-030")?.revisions).toHaveLength(2);
  });

  it("returns a draft with a meaningful senior-expert comment", async () => {
    context.role = "senior_expert";
    await expect(returnCard("KC-SEAL-030", "  Add trial evidence before validation.  ")).resolves.toEqual({ ok: true });
    const card = (await getMemoryStore().getSnapshot()).cards.find((item) => item.id === "KC-SEAL-030");
    expect(card).toMatchObject({
      returnedComment: "Add trial evidence before validation.",
      returnedByRole: "role:senior_expert@body",
    });
    await expect(returnCard("KC-SEAL-030", "x")).resolves.toMatchObject({ ok: false });
  });

  it("lets an engineer revise a returned standalone draft before senior validation", async () => {
    context.role = "senior_expert";
    expect(await returnCard("KC-SEAL-030", "Add trial evidence.")).toEqual({ ok: true });
    expect(await validateCard("KC-SEAL-030")).toMatchObject({ ok: false });
    const patch = {
      rootCause: "Path check was omitted after rotation.",
      countermeasure: "Require an approved path check at handover.",
      standardRevised: "Handover checklist updated and trial checked.",
    };
    expect(await reviseReturnedCard("KC-SEAL-030", patch)).toMatchObject({ ok: false });
    context.role = "engineer";
    expect(await reviseReturnedCard("KC-SEAL-030", patch)).toEqual({ ok: true });
    expect(await reviseReturnedCard("KC-SEAL-030", patch)).toMatchObject({ ok: false });
    expect((await getMemoryStore().getSnapshot()).cards.filter((card) => card.id === "KC-SEAL-030").map((card) => card.revision)).toEqual([1, 2]);
    context.role = "senior_expert";
    expect(await validateCard("KC-SEAL-030")).toEqual({ ok: true });
    expect((await getMemoryStore().getSnapshot()).cards.filter((card) => card.id === "KC-SEAL-030").at(-1)).toMatchObject({ revision: 3, status: "validated" });
  });

  it("fails safely for an unknown card ID", async () => {
    context.role = "senior_expert";
    await expect(validateCard("missing-card")).resolves.toEqual({ ok: false, error: "Knowledge card not found." });
  });

  it("routes an unsupported question to the owner engineer", async () => {
    await expect(routeToOwner("How do we fix paint orange peel?")).resolves.toEqual({ ok: true });
    expect((await getMemoryStore().getSnapshot()).routedQuestions.at(-1)).toMatchObject({
      ownerRole: "role:engineer@body",
      status: "routed",
    });
  });

  it("exposes current-shift model reviews and station decision history", async () => {
    const board = await getShiftBoardView();
    expect(board.modelReviews).toContainEqual(expect.objectContaining({
      id: "review-st02-current",
      stationId: "st-02",
      status: "pending",
    }));
    const station = await getStationView("st-02");
    expect(station?.decisionHistory).toHaveLength(3);
    expect(station?.decisionHistory[0].operatorDecision.kind).toBe("reject");

    context.role = "team_leader";
    await verifyRejection("review-st02-current");
    expect((await getShiftBoardView()).modelReviews).toContainEqual(expect.objectContaining({
      id: "review-st02-current",
      status: "verified",
      eligibleForModelUpdate: true,
    }));
  });

  it("does not verify a review without an operator rejection for every alert", async () => {
    await getMemoryStore().mutate((draft) => {
      draft.decisions = draft.decisions.filter((item) => item.alertId !== "alert-st02-reflection-1");
    });
    context.role = "team_leader";
    expect(await verifyRejection("review-st02-current")).toMatchObject({ ok: false });
    expect((await getShiftBoardView()).modelReviews[0].eligibleForModelUpdate).toBe(false);
  });
});
