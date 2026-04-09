import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applyTenantToolConfigChangeForTenant,
  TenantRuntimeConfigVersionConflictError,
} from "../../../../../../../../db/control-plane";
import { authenticateTenantRuntimeRequest } from "../../../../../../../../lib/runtime-auth";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  expectedEntryVersion: z.number().int().positive().optional(),
  patch: z.record(z.string(), z.unknown()),
  summary: z.string().trim().min(1).max(500).optional(),
});

export async function POST(
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
    const body = requestSchema.parse(await request.json());
    const result = await applyTenantToolConfigChangeForTenant({
      createdByExternalId: null,
      createdByType: "runtime",
      expectedEntryVersion: body.expectedEntryVersion,
      patch: body.patch,
      summary: body.summary,
      surfaceKey,
      surfaceKind,
      tenantId,
    });

    return json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(
        {
          code: "schema_invalid",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid runtime surface payload",
        },
        400,
      );
    }

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
        code: "semantic_invalid",
        message: error.message,
      },
      400,
    );
  }

  return json(
    {
      code: "runtime_surface_failed",
      message: "Runtime surface apply failed",
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
