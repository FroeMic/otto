import {
  buildForwardedSlackHeaders,
  parseSlackIngressRequest,
} from "./request";
import type {
  ForwardSlackIngressForTeam,
  SlackIngressRequestType,
} from "./types";

export async function handleSlackIngressRequest(
  request: Request,
  requestType: SlackIngressRequestType,
  options: {
    forwardSlackIngressForTeam?: ForwardSlackIngressForTeam;
  } = {},
) {
  try {
    if (!options.forwardSlackIngressForTeam) {
      return Response.json(
        {
          error: "Slack ingress forwarding is not configured for this runtime surface.",
        },
        { status: 501 },
      );
    }

    const body = await request.text();
    const parsed = parseSlackIngressRequest({
      body,
      requestType,
    });

    if (parsed.directResponse) {
      return new Response(parsed.directResponse.body, {
        headers: {
          "Content-Type": parsed.directResponse.contentType,
        },
        status: parsed.directResponse.status,
      });
    }

    if (!parsed.teamId) {
      return Response.json(
        {
          error: "Unable to determine Slack team_id for ingress routing.",
        },
        { status: 400 },
      );
    }

    const response = await options.forwardSlackIngressForTeam({
      body,
      enterpriseId: parsed.enterpriseId,
      headers: buildForwardedSlackHeaders(request),
      requestPath: new URL(request.url).pathname,
      requestType,
      teamId: parsed.teamId,
    });
    const headers = new Headers();
    const contentType =
      response.headers["content-type"] ?? "text/plain; charset=utf-8";

    headers.set("Content-Type", contentType);

    for (const headerName of ["x-slack-no-retry", "retry-after"]) {
      const value = response.headers[headerName];

      if (value) {
        headers.set(headerName, value);
      }
    }

    return new Response(response.body, {
      headers,
      status: response.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Slack ingress handling failed";
    const status = resolveSlackIngressErrorStatus(message);

    return Response.json(
      {
        error: message,
      },
      { status },
    );
  }
}

function resolveSlackIngressErrorStatus(message: string) {
  if (
    message.startsWith("No connected Slack installation") ||
    message.startsWith("Multiple tenants are connected")
  ) {
    return 404;
  }

  if (message.includes("Unable to determine Slack team_id")) {
    return 400;
  }

  return 502;
}
