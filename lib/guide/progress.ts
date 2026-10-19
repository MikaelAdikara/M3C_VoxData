import { createSeedData } from "@/lib/seed";
import type { Role, StoreSnapshot } from "@/lib/types";

/**
 * Where a visitor stands in the guided demo, read from their own demo state.
 * Steps the server cannot see (asking the assistant, opening a page) are tracked in the browser.
 */
export interface GuideProgress {
  role: Role;
  defectInjected: boolean;
  operatorConfirmed: boolean;
  teamLeaderDecided: boolean;
  repeatTicketId: string | null;
  a3Drafted: boolean;
  cardValidated: boolean;
}

export const GUIDE_DEFECT_ALERT_ID = "alert-st04-open-001";
const REPEAT_ALERT_IDS = ["alert-sim-repeat-excess-1", "alert-sim-repeat-excess-2", "alert-sim-repeat-excess-3"];
const SHIFT_DECISIONS = new Set(["stop_fix", "contain", "continue"]);

let seedValidated: Set<string> | undefined;
function validatedInSeed(): Set<string> {
  seedValidated ??= new Set(createSeedData().cards.filter((c) => c.status === "validated").map((c) => `${c.id}#${c.revision}`));
  return seedValidated;
}

export function buildGuideProgress(snapshot: StoreSnapshot, role: Role): GuideProgress {
  const decisions = snapshot.decisions.filter((d) => d.alertId === GUIDE_DEFECT_ALERT_ID);
  const repeatTicket = snapshot.tickets.find((t) => REPEAT_ALERT_IDS.every((id) => t.triggerAlertIds.includes(id)));
  const seeded = validatedInSeed();
  return {
    role,
    defectInjected: snapshot.alerts.some((a) => a.id === GUIDE_DEFECT_ALERT_ID),
    operatorConfirmed: decisions.some((d) => d.kind === "confirm"),
    teamLeaderDecided: decisions.some((d) => SHIFT_DECISIONS.has(d.kind)),
    repeatTicketId: repeatTicket?.id ?? null,
    a3Drafted: snapshot.tickets.some((t) => (t.aiDraft?.sentences.length ?? 0) > 0),
    cardValidated: snapshot.cards.some((c) => c.status === "validated" && !seeded.has(`${c.id}#${c.revision}`)),
  };
}
