import { NextResponse } from "next/server";

import { findRuntimeIntegrationFunctionsForTenant } from "@/db/control-plane";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const body = await request.json();
    const query = typeof body?.query === "string" ? body.query : "";

    if (!query.trim()) {
      return json(
        {
          code: "runtime_integrations_failed",
          message: "query is required.",
        },
        400,
      );
    }

    const result = await findRuntimeIntegrationFunctionsForTenant({
      query,
      tenantId,
    });

    console.info(
      `[runtime-integrations] find tenant=${tenantId} query=${JSON.stringify(query)} matches=${result.matches.length}`,
    );

    return json(result);
  } catch (error) {
    console.error("[runtime-integrations] find failed", error);
    return handleRuntimeRouteError(error);
  }
}

function handleRuntimeRouteError(error: unknown) {
  if (
    error instanceof Error &&
    (error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token")
  ) {
    return json(
      {
        code: "unauthorized",
        message: error.message,
      },
      401,
    );
  }

  if (error instanceof Error) {
    return json(
      {
        code: "runtime_integrations_failed",
        message: error.message,
      },
      400,
    );
  }

  return json(
    {
      code: "runtime_integrations_failed",
      message: "Runtime integrations request failed",
    },
    500,
  );
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}
