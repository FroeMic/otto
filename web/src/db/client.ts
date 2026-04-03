import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "@/lib/env";

const globalForDb = globalThis as unknown as {
  __dbClient?: postgres.Sql;
};

function getClient() {
  if (!globalForDb.__dbClient) {
    globalForDb.__dbClient = postgres(getEnv().DATABASE_URL, {
      max: 10,
    });
  }
  return globalForDb.__dbClient;
}

export function getDb() {
  return drizzle(getClient());
}
