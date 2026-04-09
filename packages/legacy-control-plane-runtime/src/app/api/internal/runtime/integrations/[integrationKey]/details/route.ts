import { getRuntimeIntegrationDetailsForTenant } from "../../../../../../../db/control-plane";
import { authenticateTenantRuntimeRequest } from "../../../../../../../lib/runtime-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ integrationKey: string }> },
) {
  let tenantId: string | null = null;
  let integrationKey = "";

  try {
    const auth = await authenticateTenantRuntimeRequest(request);
    tenantId = auth.tenantId;
    const routeParams = await context.params;
    integrationKey =
      typeof routeParams.integrationKey === "string"
        ? routeParams.integrationKey
        : "";

    if (!integrationKey.trim()) {
      throw new Error("integrationKey is required.");
    }

    const body = await request.json();
    const detailType =
      body?.detailType === "command" || body?.detailType === "command_group"
        ? body.detailType
        : null;
    const detailKey = typeof body?.detailKey === "string" ? body.detailKey : "";

    if (!detailType) {
      throw new Error("detailType must be command or command_group.");
    }

    if (!detailKey.trim()) {
      throw new Error("detailKey is required.");
    }

    const details = await getRuntimeIntegrationDetailsForTenant({
      detailKey,
      detailType,
      integrationKey,
      tenantId,
    });

    if (!details) {
      return json(
        {
          code: "not_found",
          message: `${detailType} ${detailKey} is not available on integration ${integrationKey}.`,
        },
        404,
      );
    }

    console.info(
      `[runtime-integrations] get-details tenant=${tenantId} integration=${integrationKey} detailType=${detailType} detailKey=${detailKey}`,
    );

    return json({
      details,
    });
  } catch (error) {
    console.error(
      `[runtime-integrations] get-details tenant=${tenantId ?? "unknown"} integration=${integrationKey || "unknown"} failed`,
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
