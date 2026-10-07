import { beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ role: "operator" as string, revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(() => ({ value: context.role })) })) }));
vi.mock("next/cache", () => ({ revalidatePath: context.revalidatePath }));

import { confirmAlert } from "@/lib/actions/alerts";
import { createCameraTicket } from "@/lib/actions/camera";
import { advanceSimulatedProduction, injectTrueDefect, resetDemo } from "@/lib/actions/simulator";
import { decideShift, restartLine } from "@/lib/actions/shift";
import { getCameraView, getLineView, getSimulatorView, getTrailView } from "@/lib/queries";
import { getMemoryStore, resetMemoryStore } from "@/lib/store/memory";

describe("BE-4 actions and persistence", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    context.role = "operator";
    context.revalidatePath.mockReset();
    await resetMemoryStore();
  });

  it("authorizes and deduplicates a separate camera maintenance ticket", async () => {
    const cameraId = "sealer-edge-02/cam-01";
    expect(await createCameraTicket(cameraId, "Check lens")).toMatchObject({ ok: false });
    context.role = "team_leader";
    expect(await createCameraTicket("missing", "Check lens")).toMatchObject({ ok: false });
    expect(await createCameraTicket(cameraId, "  ")).toMatchObject({ ok: false });
    expect(await createCameraTicket(cameraId, "Check lens\nnow")).toMatchObject({ ok: false });
    expect(await createCameraTicket(cameraId, "Check lens and lighting")).toEqual({ ok: true });
    expect(await createCameraTicket(cameraId, "Retry request")).toEqual({ ok: true });
    const view = await getCameraView();
    expect(view.maintenanceTickets).toHaveLength(1);
    expect(view.maintenanceTickets[0]).toMatchObject({ cameraId, reason: "Check lens and lighting", createdByRole: "role:team_leader@body", status: "open" });
    expect(view.cameras.find((camera) => camera.id === cameraId)?.maintenanceTicketId).toBe(view.maintenanceTickets[0].id);
    expect(context.revalidatePath).toHaveBeenCalledWith("/cameras");
    expect((await getMemoryStore().getSnapshot()).tickets).toHaveLength(8);
  });

  it("deduplicates concurrent camera maintenance requests atomically", async () => {
    context.role = "engineer";
    const cameraId = "sealer-edge-02/cam-01";
    const results = await Promise.all(Array.from({ length: 5 }, () => createCameraTicket(cameraId, "Inspect lens glare")));
    expect(results.every((result) => result.ok)).toBe(true);
    expect((await getMemoryStore().getSnapshot()).cameraMaintenanceTickets).toHaveLength(1);
  });

  it("stops only on a TL decision and restarts only after the TL records repair", async () => {
    expect(await injectTrueDefect()).toEqual({ ok: true });
    expect((await getLineView()).line.state).toBe("running");
    expect(await confirmAlert("alert-st04-open-001")).toEqual({ ok: true });
    expect((await getLineView()).stations.find((item) => item.station.id === "st-04")?.state).toBe("yellow_andon");
    expect(await restartLine("Repair complete")).toMatchObject({ ok: false });
    context.role = "team_leader";
    expect(await decideShift("alert-st04-open-001", "stop_fix", "Hold body and check nozzle")).toEqual({ ok: true });
    const stopped = await getLineView();
    expect(stopped.line.state).toBe("stopped");
    expect(stopped.line.heldBodyId).toBe("K2-27-031487");
    expect(stopped.flaggedBody?.state).toBe("held_for_repair");
    expect(await advanceSimulatedProduction(stopped.line.bodiesCompleted)).toMatchObject({ ok: false });
    const trail = await getTrailView("alert-st04-open-001");
    expect(trail?.steps.map((step) => step.kind)).toEqual(["flagged", "confirmed", "team_leader_decision"]);
    context.role = "operator";
    expect(await restartLine("Repair complete")).toMatchObject({ ok: false });
    context.role = "team_leader";
    expect(await restartLine("  ")).toMatchObject({ ok: false });
    expect(await restartLine("Repair complete and body checked")).toEqual({ ok: true });
    expect((await getLineView()).line.state).toBe("running");
    expect((await getLineView()).line.restartedByRole).toBe("role:team_leader@body");
    expect(await restartLine("Retry")).toMatchObject({ ok: false });
  });

  it("stores simulated production once per expected count and reset restores the fingerprint", async () => {
    const before = await getSimulatorView();
    expect(before.isCanonicalReset).toBe(true);
    expect(await advanceSimulatedProduction(68)).toEqual({ ok: true });
    expect(await advanceSimulatedProduction(68)).toEqual({ ok: true });
    expect((await getLineView()).line.bodiesCompleted).toBe(69);
    expect((await getSimulatorView()).isCanonicalReset).toBe(false);
    expect(await resetDemo()).toEqual({ ok: true });
    const after = await getSimulatorView();
    expect(after.seedFingerprint).toBe(before.seedFingerprint);
    expect(after.currentFingerprint).toBe(before.currentFingerprint);
    expect(after.isCanonicalReset).toBe(true);
  });

  it("deduplicates concurrent simulated production ticks", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => advanceSimulatedProduction(68)));
    expect(results.every((result) => result.ok)).toBe(true);
    expect((await getLineView()).line.bodiesCompleted).toBe(69);
  });
});
