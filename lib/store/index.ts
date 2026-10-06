import { getDrizzleStore } from "@/lib/store/drizzle";
import { getMemoryStore } from "@/lib/store/memory";
import type { StoreSnapshot } from "@/lib/types";

export interface LearningLineStore {
  getSnapshot(): Promise<StoreSnapshot>;
  mutate<T>(mutation: (draft: StoreSnapshot) => T | Promise<T>): Promise<T>;
  reset(): Promise<StoreSnapshot>;
}

export function getStore(): LearningLineStore {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) return getDrizzleStore(databaseUrl);
  return getMemoryStore();
}

export function getStoreBackend(): "postgres" | "memory" {
  return process.env.DATABASE_URL?.trim() ? "postgres" : "memory";
}
