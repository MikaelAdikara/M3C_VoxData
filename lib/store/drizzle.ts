import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

export function createDatabaseClient(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 1 });
  return { client, db: drizzle(client, { schema }) };
}
