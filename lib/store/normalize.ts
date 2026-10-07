import { createSeedCameras, createSeedLineOperation, createSeedRecordingGaps } from "@/lib/seed";
import type { StoreSnapshot } from "@/lib/types";

// Older Postgres snapshots have no BE-4 fields. Keep their existing decisions and
// history while supplying deterministic defaults for the new domain objects.
export function normalizeSnapshot(snapshot: StoreSnapshot): StoreSnapshot {
  const legacy = snapshot as StoreSnapshot & Partial<StoreSnapshot>;
  const latestStop = [...legacy.decisions]
    .filter((decision) => decision.kind === "stop_fix")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const stoppedAlert = latestStop && legacy.alerts.find((alert) => alert.id === latestStop.alertId);
  return {
    ...legacy,
    alerts: legacy.alerts.map((alert) => {
      const isReflection = alert.image.includes("reflection") || alert.id.includes("reflection");
      const defect = alert.defectTypeId;
      const visualScenarioId = isReflection ? "reflection-false-alarm" : defect === "BEAD_BREAK" ? "bead-break-reference" : defect === "BEAD_EXCESS" ? "bead-excess-reference" : defect ? `${defect.toLowerCase().replace("_", "-")}-simulation` : undefined;
      return {
        ...alert,
        image: alert.image.startsWith("/beads/") ? "" : alert.image,
        mask: alert.mask.startsWith("/beads/") ? "" : alert.mask,
        visualScenarioId: alert.visualScenarioId ?? visualScenarioId,
      };
    }),
    cameras: legacy.cameras ?? createSeedCameras(),
    recordingGaps: legacy.recordingGaps ?? createSeedRecordingGaps(),
    cameraMaintenanceTickets: legacy.cameraMaintenanceTickets ?? [],
    lineOperation: legacy.lineOperation ?? (latestStop && stoppedAlert
      ? { state: "stopped", stoppedByDecisionId: latestStop.id, heldBodyId: stoppedAlert.bodyId, stoppedAt: latestStop.createdAt, bodiesCompleted: 68 }
      : createSeedLineOperation()),
  };
}
