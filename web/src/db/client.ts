import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "@/lib/env";

const globalForDb = globalThis as unknown as {
  __dbClient?: postgres.Sql;
};

function getClient() {
  if (!globalForDb.__dbClient) {
    console.info("[db] initializing postgres client", {
      maxConnections: 10,
    });
    globalForDb.__dbClient = postgres(getEnv().DATABASE_URL, {
      max: 10,
      onclose: (connectionId) => {
        console.warn("[db] connection closed", {
          connectionId,
        });
      },
      onnotice: (notice) => {
        console.warn("[db] notice", {
          code: notice.code,
          message: notice.message,
          severity: notice.severity,
        });
      },
    });
  }
  return globalForDb.__dbClient;
}

export function getDb() {
  return drizzle(getClient());
}
