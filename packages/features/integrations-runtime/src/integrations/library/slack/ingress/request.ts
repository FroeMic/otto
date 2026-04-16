import type { SlackIngressRequestType } from "./types";

export type ParsedSlackIngressRequest = {
  directResponse?: {
    body: string;
    contentType: string;
    status: number;
  };
  enterpriseId: string | null;
  teamId: string | null;
};

export function parseSlackIngressRequest(input: {
  body: string;
  requestType: SlackIngressRequestType;
}): ParsedSlackIngressRequest {
  switch (input.requestType) {
    case "events":
      return parseSlackEventRequest(input.body);
    case "commands":
      return parseSlackCommandRequest(input.body);
    case "interactivity":
      return parseSlackInteractivityRequest(input.body);
    default:
      return {
        enterpriseId: null,
        teamId: null,
      };
  }
}

export function buildForwardedSlackHeaders(request: Request) {
  const forwarded: Record<string, string> = {};
  const contentType = request.headers.get("content-type");

  if (contentType) {
    forwarded["content-type"] = contentType;
  }

  for (const headerName of [
    "x-slack-request-timestamp",
    "x-slack-signature",
    "x-slack-retry-num",
    "x-slack-retry-reason",
    "x-slack-no-retry",
    "user-agent",
  ]) {
    const value = request.headers.get(headerName);

    if (value) {
      forwarded[headerName] = value;
    }
  }

  return forwarded;
}

function parseSlackEventRequest(body: string): ParsedSlackIngressRequest {
  const payload = parseJsonRecord(body);

  if (
    payload?.type === "url_verification" &&
    typeof payload.challenge === "string"
  ) {
    return {
      directResponse: {
        body: payload.challenge,
        contentType: "text/plain; charset=utf-8",
        status: 200,
      },
      enterpriseId: readString(payload.enterprise_id),
      teamId: readString(payload.team_id),
    };
  }

  const authorizations = Array.isArray(payload?.authorizations)
    ? payload.authorizations
    : [];
  const firstAuthorization = authorizations.find(
    (value): value is Record<string, unknown> =>
      Boolean(value) && typeof value === "object" && !Array.isArray(value),
  );

  return {
    enterpriseId:
      readString(payload?.enterprise_id) ??
      readString(firstAuthorization?.enterprise_id),
    teamId:
      readString(payload?.team_id) ?? readString(firstAuthorization?.team_id),
  };
}

function parseSlackCommandRequest(body: string): ParsedSlackIngressRequest {
  const form = new URLSearchParams(body);

  if (form.get("ssl_check") === "1") {
    return {
      directResponse: {
        body: "",
        contentType: "text/plain; charset=utf-8",
        status: 200,
      },
      enterpriseId: readString(form.get("enterprise_id")),
      teamId: readString(form.get("team_id")),
    };
  }

  return {
    enterpriseId: readString(form.get("enterprise_id")),
    teamId: readString(form.get("team_id")),
  };
}

function parseSlackInteractivityRequest(
  body: string,
): ParsedSlackIngressRequest {
  const form = new URLSearchParams(body);

  if (form.get("ssl_check") === "1") {
    return {
      directResponse: {
        body: "",
        contentType: "text/plain; charset=utf-8",
        status: 200,
      },
      enterpriseId: null,
      teamId: null,
    };
  }

  const payload = parseJsonRecord(form.get("payload") ?? "");
  const team = asRecord(payload?.team);
  const user = asRecord(payload?.user);

  return {
    enterpriseId:
      readString(payload?.enterprise_id) ??
      readString(team?.enterprise_id) ??
      readString(user?.enterprise_id),
    teamId:
      readString(team?.id) ??
      readString(payload?.team_id) ??
      readString(user?.team_id),
  };
}

function parseJsonRecord(value: string) {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    return asRecord(parsed);
  } catch {
    return null;
  }
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
