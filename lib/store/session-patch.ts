import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

import type { StoreSnapshot } from "@/lib/types";

// A visitor's demo state is the deterministic seed plus a small patch: entities the
// visitor added or changed (by id), entities removed, and whole values for the rest.
// The patch is what the cookie session store keeps, so it must stay a few kilobytes.

type SnapshotKey = keyof StoreSnapshot;

interface ArrayPatch {
  /** Changed or new entities, new ones in the order they appear in the visitor's state. */
  u?: unknown[];
  /** Ids of seed entities the visitor's state no longer has. */
  d?: string[];
}

export interface SessionPatch {
  /** Fingerprint of the seed the patch was taken against. */
  v: string;
  /** Entity arrays patched by id. */
  a: Partial<Record<SnapshotKey, ArrayPatch>>;
  /** Other values replaced whole. */
  o: Partial<Record<SnapshotKey, unknown>>;
}

// Knowledge cards keep every revision under one id, so the key includes the revision.
function entityId(item: unknown): string | undefined {
  if (typeof item !== "object" || item === null) return undefined;
  const { id, revision } = item as { id?: unknown; revision?: unknown };
  if (typeof id !== "string") return undefined;
  return typeof revision === "number" ? `${id}#${revision}` : id;
}

// Arrays whose items all have a unique key are patched item by item; anything else is
// stored whole, which is always correct, only larger.
function isEntityArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  const keys = value.map(entityId);
  return keys.every((key) => key !== undefined) && new Set(keys).size === keys.length;
}

export function seedFingerprint(seed: StoreSnapshot): string {
  return createHash("sha256").update(JSON.stringify(seed)).digest("hex").slice(0, 16);
}

export function diffSnapshot(seed: StoreSnapshot, current: StoreSnapshot, version: string): SessionPatch {
  const patch: SessionPatch = { v: version, a: {}, o: {} };
  for (const key of Object.keys(current) as SnapshotKey[]) {
    const before = seed[key];
    const after = current[key];
    if (isEntityArray(before) && isEntityArray(after)) {
      const seedById = new Map(before.map((item) => [entityId(item)!, JSON.stringify(item)]));
      const currentIds = new Set(after.map((item) => entityId(item)!));
      const u = after.filter((item) => seedById.get(entityId(item)!) !== JSON.stringify(item));
      const d = [...seedById.keys()].filter((id) => !currentIds.has(id));
      if (u.length || d.length) patch.a[key] = { ...(u.length ? { u } : {}), ...(d.length ? { d } : {}) };
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      patch.o[key] = after;
    }
  }
  return patch;
}

export function applyPatch(seed: StoreSnapshot, patch: SessionPatch): StoreSnapshot {
  const result = structuredClone(seed) as unknown as Record<SnapshotKey, unknown>;
  for (const [key, change] of Object.entries(patch.a) as [SnapshotKey, ArrayPatch][]) {
    const base = result[key];
    if (!isEntityArray(base)) throw new Error(`Patch targets a non-entity field: ${key}`);
    const updates = new Map((change.u ?? []).map((item) => [entityId(item)!, item]));
    const removed = new Set(change.d ?? []);
    const seedIds = new Set(base.map((item) => entityId(item)!));
    const kept = base
      .filter((item) => !removed.has(entityId(item)!))
      .map((item) => updates.get(entityId(item)!) ?? item);
    const added = (change.u ?? []).filter((item) => !seedIds.has(entityId(item)!));
    result[key] = [...kept, ...added];
  }
  for (const [key, value] of Object.entries(patch.o) as [SnapshotKey, unknown][]) {
    result[key] = structuredClone(value);
  }
  return result as unknown as StoreSnapshot;
}

export function encodePatch(patch: SessionPatch): string {
  return gzipSync(JSON.stringify(patch)).toString("base64url");
}

export function decodePatch(encoded: string): SessionPatch {
  const parsed = JSON.parse(gunzipSync(Buffer.from(encoded, "base64url")).toString("utf8")) as SessionPatch;
  if (typeof parsed?.v !== "string" || typeof parsed.a !== "object" || typeof parsed.o !== "object") {
    throw new Error("Malformed session patch.");
  }
  return parsed;
}
