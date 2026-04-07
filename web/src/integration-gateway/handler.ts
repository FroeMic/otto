import { executeRuntimeIntegrationInGateway } from "@/integration-gateway/execute";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}

function buildExecutionErrorResponse(message: string) {
  if (message.includes("needs attention. Reconnect")) {
    const integrationLabel = message.split(" needs attention")[0]?.trim();
    const integrationKey = integrationLabel?.toLowerCase();

    return {
      error: message,
      nextAction: integrationKey
        ? {
            integrationKey,
            recommendedAction: "reconnect",
            toolName: "manage_integration_connection",
          }
        : null,
    };
  }

  if (
    message.includes("requires the") ||
    message.includes("does not accept the") ||
    message.includes("requires query to be at least")
  ) {
    return {
      error: message,
      hint: "Call find_integration_functions or get_integration before retrying, then use the operation parametersSchema and executionGuide.",
    };
  }

  return {
    error: message,
  };
}

function handleRouteError(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token"
    ) {
      return json(
        {
          error: error.message,
        },
        401,
      );
    }

    return json(buildExecutionErrorResponse(error.message), 400);
  }

  return json(
    {
      error: "Managed integration execution failed",
    },
    500,
  );
}

async function handleExecuteRequest(request: Request) {
  let tenantId: string | null = null;
  let integrationKey = "";
  let operation = "unknown";

  try {
    const auth = await authenticateTenantRuntimeRequest(request);
    tenantId = auth.tenantId;

    const body = await request.json();
    integrationKey =
      typeof body?.integrationKey === "string" ? body.integrationKey : "";
    const params =
      body?.params &&
      typeof body.params === "object" &&
      !Array.isArray(body.params)
        ? (body.params as Record<string, unknown>)
        : null;
    operation =
      typeof params?.operation === "string" ? params.operation : "unknown";

    if (!integrationKey.trim()) {
      throw new Error("integrationKey is required.");
    }

    if (!params) {
      throw new Error("params must be an object.");
    }

    const result = await executeRuntimeIntegrationInGateway({
      integrationKey,
      params,
      tenantId,
    });

    console.info(
      `[integration-gateway] execute tenant=${tenantId} integration=${integrationKey} operation=${operation} ok=true`,
    );

    return json(result);
  } catch (error) {
    console.error(
      `[integration-gateway] execute tenant=${tenantId ?? "unknown"} integration=${integrationKey || "unknown"} operation=${operation} failed`,
      error,
    );
    return handleRouteError(error);
  }
}

export async function handleIntegrationGatewayRequest(request: Request) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/healthz") {
    return json({
      ok: true,
      service: "integration-gateway",
    });
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/internal/runtime/integrations/execute"
  ) {
    return handleExecuteRequest(request);
  }

  return json(
    {
      error: "Not found",
    },
    404,
  );
}
