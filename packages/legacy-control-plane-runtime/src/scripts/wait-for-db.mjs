import "dotenv/config";

import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required for db:migrate");
  process.exit(1);
}

const timeoutMs = 30_000;
const startedAt = Date.now();

while (Date.now() - startedAt < timeoutMs) {
  try {
    const sql = postgres(databaseUrl, {
      max: 1,
      connect_timeout: 2,
    });

    await sql`select 1`;
    await sql.end();
    process.exit(0);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

console.error("Database did not become ready within 30 seconds");
process.exit(1);
