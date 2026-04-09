import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";
import {
  proxyRuntimeWebSearchRequest,
  RuntimeWebSearchProxyError,
} from "@/lib/runtime-web-search/proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    return await proxyRuntimeWebSearchRequest({
      request,
      tenantId,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function handleRouteError(error: unknown) {
  if (error instanceof RuntimeWebSearchProxyError) {
    return json(
      {
        error: error.message,
      },
      error.status,
    );
  }

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
      error: "Managed web search proxy request failed",
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
