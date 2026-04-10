import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "../lib/env";

const globalForDb = globalThis as unknown as {
  __dbClient?: postgres.Sql;
};

function getDbApplicationName() {
  const argv = process.argv.join(" ");

  if (argv.includes("src/worker/index.ts")) {
    return "otto-control-plane-worker";
  }

  if (argv.includes("next")) {
    return "otto-control-plane-web";
  }

  return "otto-control-plane";
}

function getClient() {
  if (!globalForDb.__dbClient) {
    const applicationName = getDbApplicationName();
    globalForDb.__dbClient = postgres(getEnv().DATABASE_URL, {
      connection: {
        application_name: applicationName,
      },
      max: 10,
    });
  }
  return globalForDb.__dbClient;
}

export function getDb() {
  return drizzle(getClient());
}
