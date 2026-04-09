import { NextResponse } from "next/server";

import {
  listRuntimeIntegrationCatalogForTenant,
  listRuntimeIntegrationsForTenant,
} from "@/db/control-plane";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const url = new URL(request.url);
    const scope = (url.searchParams.get("scope") ?? "installed")
      .trim()
      .toLowerCase();
    const integrations =
      scope === "available" || scope === "all"
        ? await listRuntimeIntegrationCatalogForTenant({
            tenantId,
          })
        : await listRuntimeIntegrationsForTenant({
            tenantId,
          });

    console.info(
      `[runtime-integrations] list tenant=${tenantId} scope=${scope} count=${integrations.length} keys=${integrations.map((integration) => integration.key).join(",") || "none"}`,
    );

    return json({
      integrations,
      scope,
    });
  } catch (error) {
    console.error("[runtime-integrations] list failed", error);
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
