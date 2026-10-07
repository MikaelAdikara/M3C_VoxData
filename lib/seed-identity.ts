import { createHash } from "node:crypto";

import { createSeedData, SEED_VERSION } from "@/lib/seed";
import type { StoreSnapshot } from "@/lib/types";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => item === undefined ? "null" : canonicalJson(item)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintSnapshot(snapshot: StoreSnapshot): string {
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}

export const seedFingerprint = fingerprintSnapshot(createSeedData());
export { SEED_VERSION };
