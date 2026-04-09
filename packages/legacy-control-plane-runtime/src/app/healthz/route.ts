import { NextResponse } from "next/server";
import postgres from "postgres";

import { getEnv } from "../../lib/env";

export const dynamic = "force-dynamic";

async function checkDatabase() {
  const sql = postgres(getEnv().DATABASE_URL, {
    connect_timeout: 2,
    idle_timeout: 1,
    max: 1,
  });

  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({
      timeout: 1,
    });
  }
}

export async function GET() {
  const ok = await checkDatabase();

  return NextResponse.json(
    {
      ok,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
      status: ok ? 200 : 503,
    },
  );
}

export async function HEAD() {
  const ok = await checkDatabase();

  return new NextResponse(null, {
    headers: {
      "Cache-Control": "no-store",
    },
    status: ok ? 200 : 503,
  });
}
