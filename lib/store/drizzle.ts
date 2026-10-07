import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { demoStates } from "@/db/schema";
import { createSeedData } from "@/lib/seed";
import { normalizeSnapshot } from "@/lib/store/normalize";
import type { LearningLineStore } from "@/lib/store";
import type { StoreSnapshot } from "@/lib/types";

const DEMO_STATE_ID = "learning-line-demo";

function cloneSnapshot(snapshot: StoreSnapshot): StoreSnapshot {
  return structuredClone(snapshot);
}

export function createDatabaseClient(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return { client, db: drizzle(client) };
}

export class DrizzleStore implements LearningLineStore {
  private readonly client;
  private readonly db;
  private initialization: Promise<void> | null = null;

  constructor(databaseUrl: string) {
    const connection = createDatabaseClient(databaseUrl);
    this.client = connection.client;
    this.db = connection.db;
  }

  private ensureInitialized(): Promise<void> {
    this.initialization ??= (async () => {
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS demo_states (
          id text PRIMARY KEY,
          snapshot jsonb NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `);
      await this.db
        .insert(demoStates)
        .values({
          id: DEMO_STATE_ID,
          snapshot: createSeedData(),
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoNothing({ target: demoStates.id });
    })().catch((error: unknown) => {
      this.initialization = null;
      throw error;
    });
    return this.initialization;
  }

  async getSnapshot(): Promise<StoreSnapshot> {
    await this.ensureInitialized();
    const [row] = await this.db
      .select({ snapshot: demoStates.snapshot })
      .from(demoStates)
      .where(eq(demoStates.id, DEMO_STATE_ID));
    if (!row) throw new Error("Persistent demo state is unavailable.");
    return cloneSnapshot(normalizeSnapshot(row.snapshot));
  }

  async mutate<T>(mutation: (draft: StoreSnapshot) => T | Promise<T>): Promise<T> {
    await this.ensureInitialized();
    return this.db.transaction(async (transaction) => {
      const [row] = await transaction
        .select({ snapshot: demoStates.snapshot })
        .from(demoStates)
        .where(eq(demoStates.id, DEMO_STATE_ID))
        .for("update");
      if (!row) throw new Error("Persistent demo state is unavailable.");

      const draft = cloneSnapshot(normalizeSnapshot(row.snapshot));
      const result = await mutation(draft);
      await transaction
        .update(demoStates)
        .set({ snapshot: draft, updatedAt: new Date().toISOString() })
        .where(eq(demoStates.id, DEMO_STATE_ID));
      return result;
    });
  }

  async reset(): Promise<StoreSnapshot> {
    await this.ensureInitialized();
    const seed = createSeedData();
    await this.db.transaction(async (transaction) => {
      const [row] = await transaction
        .select({ id: demoStates.id })
        .from(demoStates)
        .where(eq(demoStates.id, DEMO_STATE_ID))
        .for("update");
      if (!row) throw new Error("Persistent demo state is unavailable.");
      await transaction
        .update(demoStates)
        .set({ snapshot: seed, updatedAt: new Date().toISOString() })
        .where(eq(demoStates.id, DEMO_STATE_ID));
    });
    return cloneSnapshot(seed);
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}

const globalDatabaseStore = globalThis as typeof globalThis & {
  learningLineDatabaseStore?: { databaseUrl: string; store: DrizzleStore };
};

export function getDrizzleStore(databaseUrl: string): DrizzleStore {
  if (globalDatabaseStore.learningLineDatabaseStore?.databaseUrl !== databaseUrl) {
    globalDatabaseStore.learningLineDatabaseStore = {
      databaseUrl,
      store: new DrizzleStore(databaseUrl),
    };
  }
  return globalDatabaseStore.learningLineDatabaseStore.store;
}
