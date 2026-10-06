import type { A3, A3Field, Ticket, TicketStatus } from "@/lib/types";

export const A3_FIELDS: readonly A3Field[] = [
  "background",
  "currentCondition",
  "rootCause",
  "countermeasure",
  "check",
  "standardise",
];

export function isA3Complete(a3: A3): boolean {
  return A3_FIELDS.every((field) => a3[field].trim().length > 0);
}

export function getNextTicketStatus(ticket: Ticket): TicketStatus | null {
  if (ticket.status === "open") return "a3_in_progress";
  if (
    ticket.status === "a3_in_progress" &&
    ticket.a3.background.trim() &&
    ticket.a3.currentCondition.trim() &&
    ticket.a3.rootCause.trim() &&
    ticket.a3.countermeasure.trim()
  ) {
    return "countermeasure_trial";
  }
  if (ticket.status === "validated") return "closed";
  return null;
}
