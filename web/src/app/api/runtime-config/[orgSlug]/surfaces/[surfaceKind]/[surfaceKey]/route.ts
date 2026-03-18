import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getTenantSlackRuntimeConfigSurface,
  TenantRuntimeConfigVersionConflictError,
  updateTenantSlackRuntimeConfig,
} from "@/db/control-plane";
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
  _request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
      surfaceKey: string;
      surfaceKind: string;
    }>;
  },
) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug, surfaceKey, surfaceKind } = await context.params;

  if (!isSupportedSurface(surfaceKind, surfaceKey)) {
    return errorResponse(
      "surface_not_found",
      "Unsupported runtime config surface",
      404,
    );
  }

  const surface = await getTenantSlackRuntimeConfigSurface({
    orgSlug,
    userExternalId: user.id,
  });

  if (!surface) {
    return errorResponse(
      "surface_not_found",
      "Runtime config surface not found",
      404,
    );
  }

  return json(surface);
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
      surfaceKey: string;
      surfaceKind: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug, surfaceKey, surfaceKind } = await context.params;

    if (!isSupportedSurface(surfaceKind, surfaceKey)) {
      return errorResponse(
        "surface_not_found",
        "Unsupported runtime config surface",
        404,
      );
    }

    const body = patchSchema.parse(await request.json());
    const result = await updateTenantSlackRuntimeConfig({
      expectedEntryVersion: body.expectedEntryVersion,
      orgSlug,
      patch: body.patch,
      summary: body.summary,
      userExternalId: user.id,
    });
    const surface = await getTenantSlackRuntimeConfigSurface({
      orgSlug,
      userExternalId: user.id,
    });

    return json({
      ...result,
      surface,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "schema_invalid",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid runtime config payload",
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
          status: 400,
        },
      );
    }

    if (error instanceof TenantRuntimeConfigVersionConflictError) {
      return NextResponse.json(
        {
          code: "stale_version",
          currentEntryVersion: error.currentVersion,
          message: error.message,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
          status: 409,
        },
      );
    }

    if (error instanceof Error) {
      return errorResponse("semantic_invalid", error.message, 400);
    }

    return errorResponse(
      "runtime_config_failed",
      "Runtime config update failed",
      500,
    );
  }
}

function isSupportedSurface(surfaceKind: string, surfaceKey: string) {
  return (
    surfaceKind === SLACK_RUNTIME_CONFIG_SURFACE_KIND &&
    surfaceKey === SLACK_RUNTIME_CONFIG_SURFACE_KEY
  );
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      code,
      message,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
      status,
    },
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
