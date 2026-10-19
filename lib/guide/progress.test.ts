import { describe, expect, it } from "vitest";

import { buildGuideProgress, GUIDE_DEFECT_ALERT_ID } from "@/lib/guide/progress";
import { createSeedData } from "@/lib/seed";

describe("guided demo progress", () => {
  it("starts with nothing done on the seed", () => {
    expect(buildGuideProgress(createSeedData(), "operator")).toEqual({
      role: "operator",
      defectInjected: false,
      operatorConfirmed: false,
      teamLeaderDecided: false,
      repeatTicketId: null,
      a3Drafted: false,
      cardValidated: false,
    });
  });

  it("follows the story through operator and team-leader decisions", () => {
    const s = createSeedData();
    s.alerts.push({ ...s.alerts[0], id: GUIDE_DEFECT_ALERT_ID, status: "confirmed" });
    s.decisions.push({ id: "d1", alertId: GUIDE_DEFECT_ALERT_ID, actor: "role:operator@st-04", kind: "confirm", createdAt: "2027-04-14T08:43:00.000+07:00" });
    s.decisions.push({ id: "d2", alertId: GUIDE_DEFECT_ALERT_ID, actor: "role:team_leader@K2-Body", kind: "stop_fix", createdAt: "2027-04-14T08:44:00.000+07:00" });
    const p = buildGuideProgress(s, "team_leader");
    expect([p.defectInjected, p.operatorConfirmed, p.teamLeaderDecided]).toEqual([true, true, true]);
  });

  it("counts only cards validated after the seed", () => {
    const s = createSeedData();
    const draft = s.cards.find((c) => c.status === "draft")!;
    s.cards.push({ ...draft, revision: draft.revision + 1, status: "validated", validatedAt: "2027-04-14T09:00:00.000+07:00" });
    expect(buildGuideProgress(s, "senior_expert").cardValidated).toBe(true);
  });
});
