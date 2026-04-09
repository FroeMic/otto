import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getTenantSlackRuntimeConfigSurface,
  TenantRuntimeConfigVersionConflictError,
  updateTenantSlackRuntimeConfig,
} from "../../../../../../db/control-plane";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  allowDestructiveChanges: z.boolean().optional(),
  expectedEntryVersion: z.number().int().positive().optional(),
  patch: z.record(z.string(), z.unknown()),
  summary: z.string().trim().min(1).max(500).optional(),
});

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug } = await context.params;
    const surface = await getTenantSlackRuntimeConfigSurface({
      orgSlug,
      userExternalId: user.id,
    });

    if (!surface) {
      return errorResponse(
        "integration_settings_not_found",
        "Slack settings are not available for this workspace.",
        404,
      );
    }

    return json({
      surface,
    });
  } catch (error) {
    return errorResponse(
      "integration_settings_failed",
      error instanceof Error ? error.message : "Slack settings request failed",
      400,
    );
  }
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug } = await context.params;
    const body = patchSchema.parse(await request.json());
    const result = await updateTenantSlackRuntimeConfig({
      allowDestructiveChanges: body.allowDestructiveChanges,
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
      validation: {
        ok: true,
        warnings: result.effects?.warnings ?? [],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "schema_invalid",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid Slack settings payload",
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

    return errorResponse(
      "integration_settings_failed",
      error instanceof Error ? error.message : "Slack settings update failed",
      400,
    );
  }
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
