import {
  applyRuntimeIntegrationSettingsForTenant,
  getRuntimeIntegrationSettingsForTenant,
  TenantRuntimeConfigVersionConflictError,
  validateRuntimeIntegrationSettingsForTenant,
} from "@/db/control-plane";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ integrationKey: string }> },
) {
  let tenantId: string | null = null;
  let integrationKey = "";

  try {
    const auth = await authenticateTenantRuntimeRequest(request);
    tenantId = auth.tenantId;
    const params = await context.params;
    integrationKey =
      typeof params.integrationKey === "string" ? params.integrationKey : "";

    if (!integrationKey.trim()) {
      throw new Error("integrationKey is required.");
    }

    const settings = await getRuntimeIntegrationSettingsForTenant({
      integrationKey,
      tenantId,
    });

    if (!settings) {
      return json(
        {
          code: "not_found",
          message: `Managed integration ${integrationKey} does not expose configurable settings.`,
        },
        404,
      );
    }

    return json(settings);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ integrationKey: string }> },
) {
  try {
    const auth = await authenticateTenantRuntimeRequest(request);
    const params = await context.params;
    const integrationKey =
      typeof params.integrationKey === "string" ? params.integrationKey : "";

    if (!integrationKey.trim()) {
      throw new Error("integrationKey is required.");
    }

    const body = (await request.json().catch(() => null)) as {
      action?: string;
      expectedEntryVersion?: number;
      patch?: Record<string, unknown>;
      summary?: string;
    } | null;
    const action = body?.action === "apply" ? "apply" : "validate";

    if (
      !body?.patch ||
      typeof body.patch !== "object" ||
      Array.isArray(body.patch)
    ) {
      throw new Error("patch must be an object.");
    }

    const result =
      action === "apply"
        ? await applyRuntimeIntegrationSettingsForTenant({
            expectedEntryVersion: body.expectedEntryVersion,
            integrationKey,
            patch: body.patch,
            summary: body.summary,
            tenantId: auth.tenantId,
          })
        : await validateRuntimeIntegrationSettingsForTenant({
            integrationKey,
            patch: body.patch,
            tenantId: auth.tenantId,
          });

    if (!result) {
      return json(
        {
          code: "not_found",
          message: `Managed integration ${integrationKey} does not expose configurable settings.`,
        },
        404,
      );
    }

    return json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

function handleRouteError(error: unknown) {
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

  if (error instanceof Error) {
    if (
      error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token"
    ) {
      return json(
        {
          code: "unauthorized",
          message: error.message,
        },
        401,
      );
    }

    return json(
      {
        code: "runtime_integration_settings_failed",
        message: error.message,
      },
      400,
    );
  }

  return json(
    {
      code: "runtime_integration_settings_failed",
      message: "Runtime integration settings request failed",
    },
    500,
  );
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}
