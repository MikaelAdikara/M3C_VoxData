import { describe, expect, it } from "vitest";

import { buildCameraView, buildLineView, buildPilotView, buildTrailView } from "@/lib/be4-views";
import { buildMetricsView, buildShiftBoardView } from "@/lib/queries";
import { createSeedData, SEED_VERSION } from "@/lib/seed";
import { fingerprintSnapshot, seedFingerprint } from "@/lib/seed-identity";
import { normalizeSnapshot } from "@/lib/store/normalize";
import type { StoreSnapshot } from "@/lib/types";

describe("BE-4 deterministic backend views", () => {
  it("gives cameras bounded health and an event timeline from alerts, decisions and gaps", () => {
    const seed = createSeedData();
    const view = buildCameraView(seed, buildShiftBoardView(seed));
    expect(view.cameras).toHaveLength(8);
    expect(view.asOf).toBe(new Date("2027-03-14T08:45:00.000+07:00").toISOString());
    expect(view.cameras.every((camera) => camera.uptime14d.length === 14 && camera.uptime14d.every((n) => n >= 0 && n <= 1))).toBe(true);
    const attention = view.cameras.find((camera) => camera.stationId === "st-02")!;
    expect(attention).toMatchObject({ state: "attention", modelReviewNeeded: true, openAlertIds: [] });
    expect(attention.modelReview?.id).toBe("review-st02-current");
    expect(view.cameras.find((camera) => camera.stationId === "st-05")?.pendingDecisionAlertIds).toContain("alert-st05-confirmed-001");
    expect(view.events.filter((event) => event.cameraId === attention.id && event.kind === "reject")).toHaveLength(3);
    expect(view.events.some((event) => event.kind === "gap" && event.cameraId === "body-edge-06/cam-01")).toBe(true);
    expect(view.events.find((event) => event.alertId === "alert-st05-confirmed-001" && event.kind === "alert")).toMatchObject({
      defectTypeId: "BEAD_OFFSET",
      visualScenarioId: "bead-offset-simulation",
    });
    expect(view.cameras.find((camera) => camera.stationId === "paint-bm")?.media).toBeNull();
    expect(view.cameras.filter((camera) => camera.media?.sourceType === "public_reference").every((camera) => !camera.media?.assetId.startsWith("/"))).toBe(true);
  });

  it("derives the line from the same shift board and never infers a stop from an alert", () => {
    const seed = createSeedData();
    const board = buildShiftBoardView(seed);
    const line = buildLineView(seed, board);
    expect(line.line.state).toBe("running");
    expect(line.totals.confirmed).toBe(board.stations.reduce((sum, station) => sum + station.confirmedCount, 0));
    expect(line.stations.find((station) => station.station.id === "st-02")?.state).toBe("model_review");
    expect(line.stations.find((station) => station.station.id === "st-05")?.state).toBe("yellow_andon");
    expect(line.flaggedBody?.state).toBe("awaiting_team_leader");
  });

  it("returns only stages actually reached by a single abnormality", () => {
    const seed = createSeedData();
    const trail = buildTrailView(seed, "alert-st05-confirmed-001")!;
    expect(trail.steps.map((step) => step.kind)).toEqual(["flagged", "confirmed"]);
    expect(trail.ticketId).toBeNull();
    expect(buildTrailView(seed, "missing")).toBeNull();
  });

  it("builds a 30-day simulated pilot trajectory from canonical alert history", () => {
    const seed = createSeedData();
    const pilot = buildPilotView(seed);
    expect(pilot.dailyOverride).toHaveLength(30);
    expect(pilot.dailyOverride[0].percent).toBeCloseTo(31, 0);
    expect(pilot.currentPercent).toBe(24);
    expect(pilot.dailyOverride.every((point) => point.provenance === "simulated" && point.sourceLabel === "Simulated 30-day history")).toBe(true);
    expect(pilot.scenarios.find((scenario) => scenario.id === "bead-break-reference")?.media.externalClass).toBe("gap");
    expect(pilot.scenarios.find((scenario) => scenario.id === "bead-excess-reference")?.media.externalClass).toBe("overlap");
    expect(pilot.visualReferences).toHaveLength(7);
    expect(pilot.visualReferences.filter((item) => item.visualClass === "BEAD_BREAK")).toHaveLength(3);
    expect(pilot.externalClasses).toContainEqual({ sourceClass: "bead_rolloff", mappingStatus: "needs_domain_review" });
    expect(pilot.scenarios.some((scenario) => scenario.media.externalClass === "bead_rolloff")).toBe(false);
  });

  it("keeps public reference metadata out of simulated KPI calculations", () => {
    const seed = createSeedData();
    const metrics = buildMetricsView(seed);
    seed.cameras[0].note = "Changed visual metadata";
    expect(buildMetricsView(seed).overrideRate).toEqual(metrics.overrideRate);
    expect(metrics.gate1.every((kpi) => kpi.provenance && kpi.sourceLabel && kpi.targetSourceLabel)).toBe(true);
    expect(metrics.knowledgeProgress.map((item) => item.count)).toEqual([2, 9, 1]);
    expect(metrics.ticketProgress.find((item) => item.status === "closed")?.count).toBe(6);
  });

  it("reproduces the canonical fingerprint and upgrades legacy snapshots safely", () => {
    const first = createSeedData();
    const second = createSeedData();
    expect(first).toEqual(second);
    expect(SEED_VERSION).toBe("m3c-gate1-v1");
    expect(fingerprintSnapshot(first)).toBe(seedFingerprint);
    expect(fingerprintSnapshot(second)).toBe(seedFingerprint);
    expect(fingerprintSnapshot(JSON.parse(JSON.stringify(first)) as StoreSnapshot)).toBe(seedFingerprint);
    const old = structuredClone(first) as Partial<StoreSnapshot>;
    delete old.cameras;
    delete old.recordingGaps;
    delete old.cameraMaintenanceTickets;
    delete old.lineOperation;
    old.alerts![0].image = "/beads/bead_break.svg";
    const upgraded = normalizeSnapshot(old as StoreSnapshot);
    expect(upgraded.cameras).toHaveLength(8);
    expect(upgraded.alerts[0].image).toBe("");
    expect(upgraded.alerts[0].visualScenarioId).toBeTruthy();
    expect(upgraded.lineOperation.state).toBe("running");
  });
});
