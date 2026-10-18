import { getCookieSessionStore } from "@/lib/store/cookie-session";
import { getDrizzleStore } from "@/lib/store/drizzle";
import { getMemoryStore } from "@/lib/store/memory";
import type { StoreSnapshot } from "@/lib/types";

export interface LearningLineStore {
  getSnapshot(): Promise<StoreSnapshot>;
  mutate<T>(mutation: (draft: StoreSnapshot) => T | Promise<T>): Promise<T>;
  reset(): Promise<StoreSnapshot>;
}

export type StoreBackend = "postgres" | "session" | "memory";

// Postgres when DATABASE_URL is set. Otherwise a per-visitor cookie session on Vercel
// (serverless instances do not share memory) and the in-memory store everywhere else.
// LEARNING_LINE_STORE=session|memory overrides the default when there is no database.
export function getStoreBackend(): StoreBackend {
  if (process.env.DATABASE_URL?.trim()) return "postgres";
  const override = process.env.LEARNING_LINE_STORE?.trim();
  if (override === "session" || override === "memory") return override;
  return process.env.VERCEL ? "session" : "memory";
}

export function getStore(): LearningLineStore {
  const backend = getStoreBackend();
  if (backend === "postgres") return getDrizzleStore(process.env.DATABASE_URL!.trim());
  if (backend === "session") return getCookieSessionStore();
  return getMemoryStore();
}
