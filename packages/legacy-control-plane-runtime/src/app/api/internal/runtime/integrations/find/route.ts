import { NextResponse } from "next/server";

import {
  findRuntimeIntegrationCommandsForTenant,
  listRuntimeIntegrationCatalogForTenant,
  listRuntimeIntegrationsForTenant,
} from "../../../../../../db/control-plane";
import { authenticateTenantRuntimeRequest } from "../../../../../../lib/runtime-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const body = await request.json();
    const query = typeof body?.query === "string" ? body.query : "";
    const scope =
      body?.scope === "all" ||
      body?.scope === "available" ||
      body?.scope === "installed"
        ? body.scope
        : "installed";
    const limit =
      typeof body?.limit === "number" &&
      Number.isInteger(body.limit) &&
      body.limit >= 1 &&
      body.limit <= 50
        ? body.limit
        : 10;

    if (!query.trim()) {
      return json(
        {
          code: "runtime_integrations_failed",
          message: "query is required.",
        },
        400,
      );
    }

    const result = await findRuntimeIntegrationCommandsForTenant({
      query,
      tenantId,
    });
    const allowedKeys = new Set(
      (scope === "available" || scope === "all"
        ? await listRuntimeIntegrationCatalogForTenant({ tenantId })
        : await listRuntimeIntegrationsForTenant({ tenantId })
      ).map((integration) => integration.key),
    );
    const matches = result.matches.filter((match) =>
      allowedKeys.has(match.integrationKey),
    );

    console.info(
      `[runtime-integrations] find tenant=${tenantId} scope=${scope} query=${JSON.stringify(query)} matches=${matches.length}`,
    );

    return json({
      matches: matches.slice(0, limit),
      query: result.query,
      scope,
    });
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
