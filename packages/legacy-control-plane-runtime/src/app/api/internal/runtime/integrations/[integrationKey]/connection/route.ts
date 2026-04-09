import { getRuntimeIntegrationConnectionActionForTenant } from "../../../../../../../db/control-plane";
import { authenticateTenantRuntimeRequest } from "../../../../../../../lib/runtime-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ integrationKey: string }> },
) {
  let tenantId: string | null = null;
  let integrationKey = "";
  let action = "auto";

  try {
    const auth = await authenticateTenantRuntimeRequest(request);
    tenantId = auth.tenantId;
    const params = await context.params;
    integrationKey =
      typeof params.integrationKey === "string" ? params.integrationKey : "";

    if (!integrationKey.trim()) {
      throw new Error("integrationKey is required.");
    }

    const body = await request.json().catch(() => ({}));
    action = typeof body?.action === "string" ? body.action : "auto";

    const connectionAction =
      await getRuntimeIntegrationConnectionActionForTenant({
        action,
        integrationKey,
        tenantId,
      });

    if (!connectionAction) {
      return json(
        {
          code: "not_found",
          message: `Managed integration ${integrationKey} is not available in this runtime.`,
        },
        404,
      );
    }

    console.info(
      `[runtime-integrations] connection tenant=${tenantId} integration=${connectionAction.integrationKey} action=${connectionAction.selectedAction} recommended=${connectionAction.recommendedAction}`,
    );

    return json({
      connectionAction,
    });
  } catch (error) {
    console.error(
      `[runtime-integrations] connection tenant=${tenantId ?? "unknown"} integration=${integrationKey || "unknown"} action=${action} failed`,
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
      message: "Runtime integration connection request failed",
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
