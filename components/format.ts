import type { ShiftDecision } from "@/lib/types";

const time = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Jakarta",
});

/** Plant time (WIB) for an ISO timestamp, e.g. "08:42:17". */
const ROLE_NAME: Record<string, string> = {
  operator: "Operator",
  team_leader: "Team leader",
  engineer: "Engineer",
  senior_expert: "Senior expert",
  management: "Management",
};

/** "role:operator@st-04" -> "Operator · st-04"; other actors (model, rule) are shown as written. */
export function actorLabel(actor: string) {
  const m = /^role:([a-z_]+)@(.+)$/.exec(actor);
  if (!m) return actor.replace(/^model:/, "Model ").replace(/^rule:repeat-3-per-shift$/, "Repeat rule");
  return `${ROLE_NAME[m[1]] ?? m[1]} · ${m[2]}`;
}

export function plantTime(iso: string) {
  return time.format(new Date(iso));
}

export const DECISION_LABEL: Record<ShiftDecision, string> = {
  stop_fix: "Stop and fix",
  contain: "Contain",
  continue: "Continue with check",
};
