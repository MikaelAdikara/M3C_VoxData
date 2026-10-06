import { revalidatePath } from "next/cache";

import type { StoreSnapshot } from "@/lib/types";

export const MAX_NOTE_LENGTH = 280;

export function normalizeRequiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

export function normalizeOptionalText(value: unknown, maxLength: number): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized || undefined : null;
}

export function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

export function nextEntityId(prefix: string, existingIds: readonly string[]): string {
  const used = new Set(existingIds);
  let sequence = existingIds.length + 1;
  let candidate = `${prefix}-${String(sequence).padStart(4, "0")}`;
  while (used.has(candidate)) {
    sequence += 1;
    candidate = `${prefix}-${String(sequence).padStart(4, "0")}`;
  }
  return candidate;
}

export function nextSimulatedTimestamp(snapshot: StoreSnapshot): string {
  const shiftStart = Date.parse(snapshot.currentShift.startsAt);
  const shiftEnd = Date.parse(snapshot.currentShift.endsAt);
  const timestamps = [
    ...snapshot.alerts.map((item) => Date.parse(item.createdAt)),
    ...snapshot.decisions.map((item) => Date.parse(item.createdAt)),
    ...snapshot.ideas.map((item) => Date.parse(item.createdAt)),
  ].filter((timestamp) => timestamp >= shiftStart && timestamp <= shiftEnd);
  const latest = timestamps.length > 0 ? Math.max(...timestamps) : shiftStart;
  return new Date(Math.min(latest + 1_000, shiftEnd)).toISOString();
}

export function revalidatePaths(paths: readonly string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // Actions still return their explicit result outside a Next request context.
    }
  }
}
