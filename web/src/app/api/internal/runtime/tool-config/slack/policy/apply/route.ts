import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applyTenantSlackPolicyActionForTenant,
  TenantRuntimeConfigVersionConflictError,
} from "@/db/control-plane";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";
import { parseSlackPolicyAction } from "@/tools/slack/policy";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  action: z.unknown(),
  expectedEntryVersion: z.number().int().positive().optional(),
  summary: z.string().trim().min(1).max(500).optional(),
});

export async function POST(request: Request) {
  const start = Date.now();
  const route = "POST /api/internal/runtime/tool-config/slack/policy/apply";
  console.log(`[runtime-route] ${route} — start`);

  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    console.log(
      `[runtime-route] ${route} — authed tenant=${tenantId}, applying…`,
    );

    const body = requestSchema.parse(await request.json());
    const result = await applyTenantSlackPolicyActionForTenant({
      action: parseSlackPolicyAction(body.action),
      createdByExternalId: null,
      createdByType: "runtime",
      expectedEntryVersion: body.expectedEntryVersion,
      summary: body.summary,
      tenantId,
    });

    console.log(`[runtime-route] ${route} — 200 OK (${Date.now() - start}ms)`);
    return json(result);
  } catch (error) {
    console.error(
      `[runtime-route] ${route} — error after ${Date.now() - start}ms:`,
      error instanceof Error ? error.message : error,
    );

    if (error instanceof z.ZodError) {
      return json(
        {
          code: "schema_invalid",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid Slack policy action payload",
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
      code: "tool_config_failed",
      message: "Slack policy action failed",
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
