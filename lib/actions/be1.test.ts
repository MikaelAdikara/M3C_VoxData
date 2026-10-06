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

import { confirmAlert, rejectAlert } from "@/lib/actions/alerts";
import { submitIdea } from "@/lib/actions/ideas";
import { injectTrueDefect } from "@/lib/actions/simulator";
import { decideShift, verifyRejection } from "@/lib/actions/shift";
import { getShiftBoardView } from "@/lib/queries";
import { getMemoryStore, resetMemoryStore } from "@/lib/store/memory";

describe("BE-1 server actions", () => {
  beforeEach(async () => {
    context.role = "operator";
    context.revalidatePath.mockReset();
    await resetMemoryStore();
  });

  it("confirms an open alert as the station operator", async () => {
    await injectTrueDefect();
    await expect(confirmAlert("alert-st04-open-001")).resolves.toEqual({ ok: true });
    const snapshot = await getMemoryStore().getSnapshot();
    expect(snapshot.alerts.find((alert) => alert.id === "alert-st04-open-001")?.status).toBe(
      "confirmed",
    );
    expect(snapshot.decisions.at(-1)).toMatchObject({
      alertId: "alert-st04-open-001",
      actor: "role:operator@st-04",
      kind: "confirm",
    });
    const pending = (await getShiftBoardView()).pendingDecisions.find(
      (alert) => alert.id === "alert-st04-open-001",
    );
    expect(pending?.recommendation).toMatchObject({ decision: "stop_fix", suggestedBy: "system" });
    expect(context.revalidatePath).toHaveBeenCalledWith("/station");
    expect(context.revalidatePath).toHaveBeenCalledWith("/shift-board");
  });

  it("rejects an open alert with a valid reason and queues human verification", async () => {
    await injectTrueDefect();
    await expect(
      rejectAlert("alert-st04-open-001", "reflection", "Light reflected from the panel"),
    ).resolves.toEqual({ ok: true });
    const snapshot = await getMemoryStore().getSnapshot();
    expect(snapshot.alerts.find((alert) => alert.id === "alert-st04-open-001")?.status).toBe(
      "rejected",
    );
    expect(snapshot.decisions.at(-1)).toMatchObject({
      alertId: "alert-st04-open-001",
      kind: "reject",
      reasonCode: "reflection",
    });
    expect(snapshot.modelReviews).toContainEqual(
      expect.objectContaining({
        stationId: "st-04",
        alertIds: ["alert-st04-open-001"],
        status: "pending",
        eligibleForModelUpdate: false,
      }),
    );
  });

  it("rejects an invalid reason without changing alert state", async () => {
    await injectTrueDefect();
    await expect(
      rejectAlert("alert-st04-open-001", "not-a-reason" as never),
    ).resolves.toEqual({ ok: false, error: "Invalid rejection reason." });
    const snapshot = await getMemoryStore().getSnapshot();
    expect(snapshot.alerts.find((alert) => alert.id === "alert-st04-open-001")?.status).toBe(
      "open",
    );
  });

  it("records an explicit team leader decision and closes the confirmed alert", async () => {
    await injectTrueDefect();
    await confirmAlert("alert-st04-open-001");
    context.role = "team_leader";
    await expect(
      decideShift("alert-st04-open-001", "stop_fix", "Nozzle check"),
    ).resolves.toEqual({ ok: true });
    const snapshot = await getMemoryStore().getSnapshot();
    expect(snapshot.alerts.find((alert) => alert.id === "alert-st04-open-001")?.status).toBe(
      "closed",
    );
    expect(snapshot.decisions.at(-1)).toMatchObject({
      alertId: "alert-st04-open-001",
      actor: "role:team_leader@body",
      kind: "stop_fix",
      note: "Nozzle check",
    });
    expect((await getShiftBoardView()).pendingDecisions.map((alert) => alert.id)).not.toContain(
      "alert-st04-open-001",
    );
  });

  it("does not let an operator make the team leader decision", async () => {
    await expect(decideShift("alert-st05-confirmed-001", "contain", "Check bodies")).resolves.toEqual(
      { ok: false, error: "Only the team leader can make the shift decision." },
    );
    const snapshot = await getMemoryStore().getSnapshot();
    expect(snapshot.decisions.some((decision) => decision.alertId === "alert-st05-confirmed-001")).toBe(
      false,
    );
  });

  it("marks a rejection eligible only after team leader verification", async () => {
    const before = (await getMemoryStore().getSnapshot()).modelReviews.find(
      (review) => review.id === "review-st02-current",
    );
    expect(before).toMatchObject({ status: "pending" });
    expect(before?.eligibleForModelUpdate).not.toBe(true);

    context.role = "team_leader";
    await expect(verifyRejection("review-st02-current")).resolves.toEqual({ ok: true });
    const verified = (await getMemoryStore().getSnapshot()).modelReviews.find(
      (review) => review.id === "review-st02-current",
    );
    expect(verified).toMatchObject({
      status: "verified",
      verifiedByRole: "role:team_leader@body",
      eligibleForModelUpdate: true,
    });
    expect(verified?.verifiedAt).toBeTruthy();
  });

  it("submits a trimmed operator idea and enforces the 280-character limit", async () => {
    await expect(submitIdea("st-04", "  Add a nozzle angle visual check  ")).resolves.toEqual({
      ok: true,
    });
    const snapshot = await getMemoryStore().getSnapshot();
    expect(snapshot.ideas.at(-1)).toMatchObject({
      stationId: "st-04",
      text: "Add a nozzle angle visual check",
      status: "submitted",
    });
    await expect(submitIdea("st-04", "x".repeat(281))).resolves.toMatchObject({ ok: false });
  });

  it("fails safely for invalid or unknown IDs", async () => {
    await expect(confirmAlert("")).resolves.toEqual({ ok: false, error: "Invalid alert ID." });
    await expect(confirmAlert("missing-alert")).resolves.toEqual({
      ok: false,
      error: "Alert not found.",
    });
    context.role = "team_leader";
    await expect(verifyRejection("missing-review")).resolves.toEqual({
      ok: false,
      error: "Rejection review not found.",
    });
  });
});
