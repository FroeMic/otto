import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getTenantSlackRuntimeConfigSurfaceForTenant,
  TenantRuntimeConfigVersionConflictError,
  updateTenantSlackRuntimeConfigForTenant,
} from "@/db/control-plane";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";
import {
  SLACK_RUNTIME_CONFIG_SURFACE_KEY,
  SLACK_RUNTIME_CONFIG_SURFACE_KIND,
  slackRuntimeConfigPatchSchema,
} from "@/lib/slack-config";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  expectedEntryVersion: z.number().int().positive().optional(),
  patch: slackRuntimeConfigPatchSchema,
  summary: z.string().trim().min(1).max(500).optional(),
});

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

    if (!isSupportedSurface(surfaceKind, surfaceKey)) {
      return json(
        {
          code: "surface_not_found",
          message: "Unsupported runtime config surface",
        },
        404,
      );
    }

    const surface = await getTenantSlackRuntimeConfigSurfaceForTenant({
      tenantId,
    });

    if (!surface) {
      return json(
        {
          code: "surface_not_found",
          message: "Runtime config surface not found",
        },
        404,
      );
    }

    return json(surface);
  } catch (error) {
    return handleRuntimeRouteError(error);
  }
}

export async function PATCH(
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

    if (!isSupportedSurface(surfaceKind, surfaceKey)) {
      return json(
        {
          code: "surface_not_found",
          message: "Unsupported runtime config surface",
        },
        404,
      );
    }

    const body = patchSchema.parse(await request.json());
    const result = await updateTenantSlackRuntimeConfigForTenant({
      createdByExternalId: null,
      createdByType: "runtime",
      expectedEntryVersion: body.expectedEntryVersion,
      patch: body.patch,
      summary: body.summary ?? "Runtime updated Slack config surface",
      tenantId,
    });
    const surface = await getTenantSlackRuntimeConfigSurfaceForTenant({
      tenantId,
    });

    return json({
      ...result,
      surface,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(
        {
          code: "schema_invalid",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid runtime config payload",
        },
        400,
      );
    }

    return handleRuntimeRouteError(error);
  }
}

function handleRuntimeRouteError(error: unknown) {
  if (error instanceof TenantRuntimeConfigVersionConflictError) {
    return json(
      {
        code: "stale_version",
        currentEntryVersion: error.currentVersion,
        message: error.message,
      },
      409,
    );
  }

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
        code: "semantic_invalid",
        message: error.message,
      },
      400,
    );
  }

  return json(
    {
      code: "runtime_config_failed",
      message: "Runtime config request failed",
    },
    500,
  );
}

function isSupportedSurface(surfaceKind: string, surfaceKey: string) {
  return (
    surfaceKind === SLACK_RUNTIME_CONFIG_SURFACE_KIND &&
    surfaceKey === SLACK_RUNTIME_CONFIG_SURFACE_KEY
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
