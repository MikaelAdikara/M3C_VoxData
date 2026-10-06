import { afterEach, describe, expect, it } from "vitest";

import { getStoreBackend } from "@/lib/store";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("store backend selection", () => {
  it("uses the memory fallback when DATABASE_URL is absent or blank", () => {
    delete process.env.DATABASE_URL;
    expect(getStoreBackend()).toBe("memory");
    process.env.DATABASE_URL = "   ";
    expect(getStoreBackend()).toBe("memory");
  });

  it("selects PostgreSQL when DATABASE_URL is configured", () => {
    process.env.DATABASE_URL = "postgresql://example.invalid/demo";
    expect(getStoreBackend()).toBe("postgres");
  });
});
