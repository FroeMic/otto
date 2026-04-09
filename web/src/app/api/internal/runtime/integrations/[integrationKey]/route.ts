import { getRuntimeIntegrationForTenant } from "@/db/control-plane";
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

    const integration = await getRuntimeIntegrationForTenant({
      integrationKey,
      tenantId,
    });

    if (!integration) {
      return json(
        {
          code: "not_found",
          message: `Managed integration ${integrationKey} is not available in this runtime.`,
        },
        404,
      );
    }

    console.info(
      `[runtime-integrations] get-summary tenant=${tenantId} integration=${integration.key} enabled=${integration.status.enabled} connected=${integration.status.connected}`,
    );

    return json({
      integration,
    });
  } catch (error) {
    console.error(
      `[runtime-integrations] get tenant=${tenantId ?? "unknown"} integration=${integrationKey || "unknown"} failed`,
      error,
    );
    return handleRouteError(error);
  }
}

function handleRouteError(error: unknown) {
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
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}
