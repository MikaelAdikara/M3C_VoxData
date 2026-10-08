import { SEED_REFERENCE_CLOCK } from "@/lib/seed";
import type { StoreSnapshot } from "@/lib/types";

/** Current time in the deterministic demo, independent of the visitor's clock. */
export function simulatedNow(snapshot: StoreSnapshot): string {
  const shiftStart = Date.parse(snapshot.currentShift.startsAt);
  const shiftEnd = Date.parse(snapshot.currentShift.endsAt);
  const timestamps = [
    Date.parse(SEED_REFERENCE_CLOCK),
    ...snapshot.alerts.map((item) => Date.parse(item.createdAt)),
    ...snapshot.decisions.map((item) => Date.parse(item.createdAt)),
    ...snapshot.ideas.map((item) => Date.parse(item.createdAt)),
    ...snapshot.tickets.flatMap((item) => [item.createdAt, item.a3UpdatedAt].filter(Boolean).map((value) => Date.parse(value!))),
    ...snapshot.cards.flatMap((item) => [item.validatedAt, item.returnedAt].filter(Boolean).map((value) => Date.parse(value!))),
    ...snapshot.modelReviews.map((item) => item.verifiedAt).filter(Boolean).map((value) => Date.parse(value!)),
    ...snapshot.routedQuestions.map((item) => Date.parse(item.createdAt)),
    ...snapshot.cameraMaintenanceTickets.map((item) => Date.parse(item.createdAt)),
    ...[snapshot.lineOperation.stoppedAt, snapshot.lineOperation.restartedAt].filter(Boolean).map((value) => Date.parse(value!)),
  ].filter((timestamp) => Number.isFinite(timestamp) && timestamp >= shiftStart && timestamp <= shiftEnd);
  return new Date(Math.min(Math.max(shiftStart, ...timestamps), shiftEnd)).toISOString();
}
