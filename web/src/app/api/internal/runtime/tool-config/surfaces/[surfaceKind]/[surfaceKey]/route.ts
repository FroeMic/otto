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
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const { surfaceKey, surfaceKind } = await context.params;
    const surface = await getTenantToolConfigSurfaceForTenant({
      surfaceKey,
      surfaceKind,
      tenantId,
    });

    if (!surface) {
      return json(
        {
          code: "surface_not_found",
          message: "Unsupported tool config surface",
        },
        404,
      );
    }

    return json(surface);
  } catch (error) {
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
