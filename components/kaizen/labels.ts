import type { A3Field, CardStatus, Criticality, DefectTypeId, TicketStatus } from "@/lib/types";

export const TICKET_STEPS: { status: TicketStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "a3_in_progress", label: "A3 in progress" },
  { status: "countermeasure_trial", label: "Countermeasure trial" },
  { status: "validated", label: "Validated" },
  { status: "closed", label: "Closed" },
];

export const TICKET_LABEL = Object.fromEntries(TICKET_STEPS.map((s) => [s.status, s.label])) as Record<
  TicketStatus,
  string
>;

/** A3 blocks in reading order: left column then right column, as on the paper sheet. */
export const A3_BLOCKS: { field: A3Field; label: string; hint: string }[] = [
  { field: "background", label: "Background", hint: "Why this matters: what happened, where, how often." },
  { field: "currentCondition", label: "Current condition", hint: "What the data and the line show today." },
  { field: "rootCause", label: "Root cause", hint: "Found at the line by the owner engineer." },
  { field: "countermeasure", label: "Countermeasure", hint: "What changes, and who does it." },
  { field: "check", label: "Check", hint: "How the trial shows the countermeasure works." },
  { field: "standardise", label: "Standardise", hint: "Which standard is revised, and yokoten to which stations." },
];

export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  draft: "Draft",
  validated: "Validated",
  retired: "Retired",
};

/** Seed data uses "—" for "no standard revised yet"; show it in words. */
export function orNotYet(value: string) {
  const v = value.trim();
  return v === "" || v === "—" || v === "-" ? "Not yet" : v;
}

/** Display fallback for a ticket's defect type (TicketView carries only the id). */
export const DEFECT_DISPLAY: Record<DefectTypeId, { name: string; criticality: Criticality }> = {
  BEAD_BREAK: { name: "Broken bead", criticality: "leak_critical" },
  BEAD_MISSING: { name: "Missing bead", criticality: "leak_critical" },
  BEAD_THIN: { name: "Thin bead", criticality: "non_critical" },
  BEAD_OFFSET: { name: "Bead off path", criticality: "non_critical" },
  BEAD_EXCESS: { name: "Excess sealer", criticality: "non_critical" },
};
