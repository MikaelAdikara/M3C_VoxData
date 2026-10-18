import { cookies } from "next/headers";

import { createSeedData } from "@/lib/seed";
import type { LearningLineStore } from "@/lib/store";
import { normalizeSnapshot } from "@/lib/store/normalize";
import {
  applyPatch,
  decodePatch,
  diffSnapshot,
  encodePatch,
  seedFingerprint,
} from "@/lib/store/session-patch";
import type { StoreSnapshot } from "@/lib/types";

// Each visitor gets an isolated demo: the deterministic seed plus a patch kept in their
// own cookies. Serverless instances share nothing, so without a database this is the
// only way every page a judge opens shows the same state. It also means one judge's
// "Reset demo" never wipes another judge's walkthrough.

export const SESSION_COOKIE_PREFIX = "learning-line-demo-";
const CHUNK_LENGTH = 3_800;
const MAX_CHUNKS = 8;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type CookieJar = Awaited<ReturnType<typeof cookies>>;

let seedCache: { snapshot: StoreSnapshot; version: string } | undefined;

function seed() {
  if (!seedCache) {
    const snapshot = normalizeSnapshot(createSeedData());
    seedCache = { snapshot, version: seedFingerprint(snapshot) };
  }
  return seedCache;
}

// Within one request, later reads must see earlier writes even before the browser
// sends the new cookies back.
const writtenThisRequest = new WeakMap<CookieJar, StoreSnapshot>();

function readSnapshot(jar: CookieJar): StoreSnapshot {
  const written = writtenThisRequest.get(jar);
  if (written) return structuredClone(written);

  const { snapshot, version } = seed();
  const chunks: string[] = [];
  for (let index = 0; index < MAX_CHUNKS; index += 1) {
    const value = jar.get(`${SESSION_COOKIE_PREFIX}${index}`)?.value;
    if (!value) break;
    chunks.push(value);
  }
  if (!chunks.length) return structuredClone(snapshot);

  try {
    const patch = decodePatch(chunks.join(""));
    // A redeploy with a different seed makes old patches meaningless: start fresh.
    if (patch.v !== version) return structuredClone(snapshot);
    return applyPatch(snapshot, patch);
  } catch {
    return structuredClone(snapshot);
  }
}

function writeSnapshot(jar: CookieJar, next: StoreSnapshot | undefined) {
  const { snapshot, version } = seed();
  const encoded = next ? encodePatch(diffSnapshot(snapshot, next, version)) : "";
  const chunkCount = Math.ceil(encoded.length / CHUNK_LENGTH);
  if (chunkCount > MAX_CHUNKS) {
    throw new Error("This demo session is full. Press Reset demo to start again.");
  }
  for (let index = 0; index < MAX_CHUNKS; index += 1) {
    const name = `${SESSION_COOKIE_PREFIX}${index}`;
    if (index < chunkCount) {
      jar.set(name, encoded.slice(index * CHUNK_LENGTH, (index + 1) * CHUNK_LENGTH), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
      });
    } else if (jar.has(name)) {
      jar.delete(name);
    }
  }
  writtenThisRequest.set(jar, next ? structuredClone(next) : structuredClone(snapshot));
}

export class CookieSessionStore implements LearningLineStore {
  async getSnapshot(): Promise<StoreSnapshot> {
    return readSnapshot(await cookies());
  }

  async mutate<T>(mutation: (draft: StoreSnapshot) => T | Promise<T>): Promise<T> {
    const jar = await cookies();
    const draft = readSnapshot(jar);
    const result = await mutation(draft);
    writeSnapshot(jar, draft);
    return result;
  }

  async reset(): Promise<StoreSnapshot> {
    writeSnapshot(await cookies(), undefined);
    return structuredClone(seed().snapshot);
  }
}

const cookieSessionStore = new CookieSessionStore();

export function getCookieSessionStore(): CookieSessionStore {
  return cookieSessionStore;
}
