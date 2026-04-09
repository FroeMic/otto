import { getSlackOAuthConfig } from "@/lib/env";
import type {
  OAuthProviderDefinition,
  OAuthProviderErrorKind,
} from "@/lib/oauth/providers/types";

const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

type SlackOAuthResponse = {
  access_token?: string;
  authed_user?: {
    id?: string;
  };
  bot_user_id?: string;
  error?: string;
  ok: boolean;
  scope?: string;
  team?: {
    id?: string;
    name?: string;
  };
};

export const slackOAuthProvider: OAuthProviderDefinition = {
  buildAuthorizationUrl(input) {
    const config = getSlackOAuthConfig();
    const url = new URL(SLACK_AUTHORIZE_URL);

    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("scope", config.botScopes.join(","));
    url.searchParams.set("state", input.state);

    return url.toString();
  },

  classifyError(error) {
    const status =
      typeof error === "object" &&
      error &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : undefined;
    const code =
      typeof error === "object" &&
      error &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;
    const message =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error ?? "");

    if (
      status === 401 ||
      status === 403 ||
      code === "invalid_code" ||
      message.includes("invalid_code") ||
      message.includes("invalid_auth")
    ) {
      return "reauthorize";
    }

    return "transient";
  },

  async exchangeCode(input) {
    const config = getSlackOAuthConfig();
    const response = await fetch(SLACK_TOKEN_URL, {
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: input.code,
        redirect_uri: config.redirectUri,
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });
    const body = (await response.json()) as SlackOAuthResponse;

    if (!response.ok || !body.ok || !body.access_token || !body.team?.id) {
      throw createSlackOauthError(
        `Slack OAuth exchange failed${body.error ? `: ${body.error}` : ""}`,
        body.error === "invalid_code" ? "reauthorize" : "transient",
      );
    }

    return {
      accessToken: body.access_token,
      actorType: "app" as const,
      expiresAt: null,
      grantedScopes: (body.scope ?? "")
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
      identity: {
        externalAccountId: body.team.id,
        externalAccountLabel: body.team.name ?? null,
        providerMetadata: {
          installerUserId: body.authed_user?.id ?? null,
          scopeCsv: body.scope ?? "",
          slackBotUserId: body.bot_user_id ?? null,
          slackTeamId: body.team.id,
          slackTeamName: body.team.name ?? null,
        },
      },
      idToken: null,
      raw: {
        scopeCsv: body.scope ?? "",
        slackBotUserId: body.bot_user_id ?? null,
        slackTeamId: body.team.id,
        slackTeamName: body.team.name ?? null,
      },
      refreshToken: null,
      refreshTokenExpiresAt: null,
      tokenType: null,
    };
  },

  getAuthorizeParams() {
    return {};
  },

  getRequestedScopes() {
    return getSlackOAuthConfig().botScopes;
  },

  key: "slack",
  label: "Slack",

  async refreshAccessToken() {
    throw createSlackOauthError(
      "Slack access tokens cannot be refreshed automatically.",
      "reauthorize",
    );
  },

  usesPkce: false,
};

function createSlackOauthError(message: string, kind: OAuthProviderErrorKind) {
  const error = new Error(message) as Error & {
    kind?: OAuthProviderErrorKind;
  };

  error.kind = kind;

  return error;
}
