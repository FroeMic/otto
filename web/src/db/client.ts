import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "@/lib/env";

let client: postgres.Sql | null = null;

export function getDb() {
  if (!client) {
    client = postgres(getEnv().DATABASE_URL, {
      max: 1,
    });
  }

  return drizzle(client);
}
