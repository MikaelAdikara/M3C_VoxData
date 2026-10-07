import assert from "node:assert/strict";

import { buildCameraView, buildLineView, buildPilotView } from "@/lib/be4-views";
import { buildMetricsView, buildShiftBoardView } from "@/lib/queries";
import { createSeedData, SEED_VERSION } from "@/lib/seed";
import { fingerprintSnapshot, seedFingerprint } from "@/lib/seed-identity";

const seed = createSeedData();
const board = buildShiftBoardView(seed);
const camera = buildCameraView(seed, board);
const line = buildLineView(seed, board);
const pilot = buildPilotView(seed);
const metrics = buildMetricsView(seed);

assert.equal(fingerprintSnapshot(seed), seedFingerprint);
assert.equal(camera.cameras.length, 8);
assert(camera.events.some((event) => event.kind === "gap"));
assert.equal(line.line.state, "running");
assert.equal(pilot.dailyOverride.length, 30);
assert.equal(pilot.currentPercent, 24);
assert.equal(metrics.gate1.find((item) => item.id === "override-rate")?.value, 24);
assert.equal(metrics.knowledgeProgress.find((item) => item.status === "validated")?.count, 9);

process.stdout.write(`${SEED_VERSION} ${seedFingerprint}\n`);
process.stdout.write(`Cameras ${camera.cameras.length}, shift events ${camera.events.length}, line ${line.line.state}, pilot days ${pilot.dailyOverride.length}, override ${pilot.currentPercent}% simulated.\n`);
