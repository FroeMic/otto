import { NextResponse } from "next/server";

import { getTenantToolConfigSurfaceForTenant } from "@/db/control-plane";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      surfaceKey: string;
      surfaceKind: string;
    }>;
  },
) {
  const start = Date.now();
  const { surfaceKey, surfaceKind } = await context.params;
  const route = `GET /api/internal/runtime/tool-config/surfaces/${surfaceKind}/${surfaceKey}`;
  console.log(`[runtime-route] ${route} — start`);

  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    console.log(
      `[runtime-route] ${route} — authed tenant=${tenantId}, fetching surface…`,
    );

    const surface = await getTenantToolConfigSurfaceForTenant({
      surfaceKey,
      surfaceKind,
      tenantId,
    });

    if (!surface) {
      console.log(
        `[runtime-route] ${route} — surface not found (${Date.now() - start}ms)`,
      );
      return json(
        {
          code: "surface_not_found",
          message: "Unsupported tool config surface",
        },
        404,
      );
    }

    console.log(`[runtime-route] ${route} — 200 OK (${Date.now() - start}ms)`);
    return json(surface);
  } catch (error) {
    console.error(
      `[runtime-route] ${route} — error after ${Date.now() - start}ms:`,
      error instanceof Error ? error.message : error,
    );
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
        code: "tool_config_failed",
        message: error.message,
      },
      400,
    );
  }

  return json(
    {
      code: "tool_config_failed",
      message: "Tool config request failed",
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
