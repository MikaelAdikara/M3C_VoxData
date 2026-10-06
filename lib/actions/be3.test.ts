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
import { routeToOwner, validateCard } from "@/lib/actions/knowledge";
import { advanceTicket, requestValidation, updateA3 } from "@/lib/actions/kaizen";
import {
  injectFalseAlarm,
  injectRepeat3,
  injectTrueDefect,
  resetDemo,
} from "@/lib/actions/simulator";
import { decideShift } from "@/lib/actions/shift";
import { answerAssistantQuestion } from "@/lib/assistant/service";
import { getMetricsView, getStationView } from "@/lib/queries";
import { createSeedData } from "@/lib/seed";
import { getMemoryStore, resetMemoryStore } from "@/lib/store/memory";
import type { A3 } from "@/lib/types";

const repeatIds = [
  "alert-sim-repeat-excess-1",
  "alert-sim-repeat-excess-2",
  "alert-sim-repeat-excess-3",
];

const completeA3: A3 = {
  background: "Three confirmed excess-bead alerts at st-04.",
  currentCondition: "Corner transition flow is high on three traceable bodies.",
  rootCause: "Pulsing pressure oscillation during the corner transition.",
  countermeasure: "Match the corner flow command to the reduced robot speed.",
  check: "Three trial bodies meet the approved bead profile.",
  standardise: "Add the flow pairing check to the sealer recipe standard.",
};

describe("BE-3 simulator and reset", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.ANTHROPIC_API_KEY;
    context.role = "operator";
    context.revalidatePath.mockReset();
    await resetMemoryStore();
  });

  it("injects an open true defect without an operator or team-leader decision", async () => {
    await expect(injectTrueDefect()).resolves.toEqual({ ok: true });
    await expect(injectTrueDefect()).resolves.toEqual({ ok: true });
    const snapshot = await getMemoryStore().getSnapshot();
    expect(snapshot.alerts.filter((alert) => alert.id === "alert-st04-open-001")).toHaveLength(1);
    expect(snapshot.alerts.find((alert) => alert.id === "alert-st04-open-001")).toMatchObject({
      stationId: "st-04",
      roi: "seam-R-door-07",
      defectTypeId: "BEAD_BREAK",
      anomalyScore: 0.83,
      threshold: 0.61,
      modelVersion: "sealer-st04-v1.3",
      status: "open",
    });
    expect(snapshot.decisions.some((decision) => decision.alertId === "alert-st04-open-001")).toBe(false);
    expect((await getStationView("st-04"))?.openAlert?.id).toBe("alert-st04-open-001");
  });

  it("injects an undecided reflection false-alarm scenario", async () => {
    await expect(injectFalseAlarm()).resolves.toEqual({ ok: true });
    const snapshot = await getMemoryStore().getSnapshot();
    expect(snapshot.alerts.find((alert) => alert.id === "alert-st02-reflection-demo")).toMatchObject({
      stationId: "st-02",
      status: "open",
    });
    expect(snapshot.decisions.some((decision) => decision.alertId === "alert-st02-reflection-demo")).toBe(false);
  });

  it("drives the real repeat rule to one traceable ticket and stays idempotent", async () => {
    await expect(injectRepeat3()).resolves.toEqual({ ok: true });
    await expect(injectRepeat3()).resolves.toEqual({ ok: true });
    const snapshot = await getMemoryStore().getSnapshot();
    const alerts = snapshot.alerts.filter((alert) => repeatIds.includes(alert.id));
    const tickets = snapshot.tickets.filter((ticket) =>
      repeatIds.every((alertId) => ticket.triggerAlertIds.includes(alertId)),
    );
    expect(alerts).toHaveLength(3);
    expect(alerts.every((alert) => alert.status === "confirmed")).toBe(true);
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      stationId: "st-04",
      defectTypeId: "BEAD_EXCESS",
      status: "open",
      triggerAlertIds: repeatIds,
    });
  });

  it("restores the exact baseline on repeated reset", async () => {
    const baseline = createSeedData();
    await injectTrueDefect();
    await injectFalseAlarm();
    await injectRepeat3();
    await routeToOwner("Question added by the simulator test");
    await expect(resetDemo()).resolves.toEqual({ ok: true });
    expect(await getMemoryStore().getSnapshot()).toEqual(baseline);
    await expect(resetDemo()).resolves.toEqual({ ok: true });
    expect(await getMemoryStore().getSnapshot()).toEqual(baseline);
  });
});

describe("BE-3 demo backend dry run", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.ANTHROPIC_API_KEY;
    context.role = "operator";
    await resetMemoryStore();
  });

  it("supports the reset-to-metrics story while preserving every human authority boundary", async () => {
    expect(await resetDemo()).toEqual({ ok: true });
    expect(await injectTrueDefect()).toEqual({ ok: true });
    expect(await confirmAlert("alert-st04-open-001")).toEqual({ ok: true });

    context.role = "team_leader";
    expect(await decideShift("alert-st04-open-001", "stop_fix", "Check nozzle angle and contain the body")).toEqual({ ok: true });

    expect(await injectRepeat3()).toEqual({ ok: true });
    let snapshot = await getMemoryStore().getSnapshot();
    const ticket = snapshot.tickets.find((item) =>
      repeatIds.every((alertId) => item.triggerAlertIds.includes(alertId)),
    );
    expect(ticket).toBeDefined();

    context.role = "engineer";
    expect(await advanceTicket(ticket!.id)).toEqual({ ok: true });
    expect(await updateA3(ticket!.id, completeA3)).toEqual({ ok: true });
    expect(await advanceTicket(ticket!.id)).toEqual({ ok: true });
    expect(await requestValidation(ticket!.id)).toEqual({ ok: true });

    snapshot = await getMemoryStore().getSnapshot();
    const draft = snapshot.cards.find(
      (card) => card.sourceTicketId === ticket!.id && card.status === "draft",
    );
    expect(draft).toBeDefined();

    context.role = "senior_expert";
    expect(await validateCard(draft!.id)).toEqual({ ok: true });
    snapshot = await getMemoryStore().getSnapshot();
    const validated = snapshot.cards.find(
      (card) => card.id === draft!.id && card.status === "validated",
    );
    expect(validated).toBeDefined();

    const grounded = await answerAssistantQuestion(
      "What should we do about pulsing pressure oscillation?",
      snapshot.cards,
    );
    expect(grounded).toMatchObject({
      mode: "offline",
      citations: [{ cardId: validated!.id, revision: validated!.revision }],
    });
    expect(grounded.text).toContain(`[${validated!.id} r${validated!.revision}]`);

    const noCard = await answerAssistantQuestion("How do we repair paint orange peel?", snapshot.cards);
    expect(noCard.mode).toBe("no_card");
    context.role = "operator";
    expect(await routeToOwner("How do we repair paint orange peel?")).toEqual({ ok: true });

    const metrics = await getMetricsView();
    expect(metrics).toMatchObject({
      dataLabel: "Simulated data",
      learningCycleDays: 19,
      ideas: { submitted: 40, answeredWithin7Days: 31, implemented: 11 },
    });
    expect((await getMemoryStore().getSnapshot()).routedQuestions).toHaveLength(1);
  });
});
