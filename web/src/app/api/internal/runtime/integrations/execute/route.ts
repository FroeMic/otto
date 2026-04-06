import { executeRuntimeIntegrationForTenant } from "@/db/control-plane";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

    const result = await executeRuntimeIntegrationForTenant({
      integrationKey,
      params,
      tenantId,
    });

    console.info(
      `[runtime-integrations] execute tenant=${tenantId} integration=${integrationKey} operation=${operation} ok=true`,
    );

    return json(result);
  } catch (error) {
    console.error(
      `[runtime-integrations] execute tenant=${tenantId ?? "unknown"} integration=${integrationKey || "unknown"} operation=${operation} failed`,
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
          error: error.message,
        },
        401,
      );
    }

    return json(
      {
        error: error.message,
      },
      400,
    );
  }

  return json(
    {
      error: "Managed integration execution failed",
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
