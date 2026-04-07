import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

function copyHeaderIfPresent(
  headers: Headers,
  name: string,
  value: string | null,
) {
  if (value) {
    headers.set(name, value);
  }
}

export async function POST(request: Request) {
  const upstreamUrl = `${getEnv().INTEGRATION_GATEWAY_INTERNAL_URL}/api/internal/runtime/integrations/execute`;
  const requestBody = await request.text();

  try {
    const upstreamHeaders = new Headers();
    copyHeaderIfPresent(
      upstreamHeaders,
      "authorization",
      request.headers.get("authorization"),
    );
    copyHeaderIfPresent(
      upstreamHeaders,
      "content-type",
      request.headers.get("content-type"),
    );

    const upstreamResponse = await fetch(upstreamUrl, {
      body: requestBody,
      headers: upstreamHeaders,
      method: "POST",
    });

    return new Response(upstreamResponse.body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type":
          upstreamResponse.headers.get("content-type") ?? "application/json",
      },
      status: upstreamResponse.status,
    });
  } catch (error) {
    console.error("[runtime-integrations] execute gateway proxy failed", error);

    return Response.json(
      {
        error: "Integration gateway unavailable",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
        status: 502,
      },
    );
  }
}
