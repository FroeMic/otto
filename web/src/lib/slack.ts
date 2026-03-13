import { getSlackOAuthConfig } from "@/lib/env";

const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

type SlackOAuthResponse = {
  access_token?: string;
  app_id?: string;
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

export function buildSlackInstallUrl(state: string) {
  const config = getSlackOAuthConfig();
  const searchParams = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.botScopes.join(","),
    state,
  });

  return `${SLACK_AUTHORIZE_URL}?${searchParams.toString()}`;
}

export async function exchangeSlackCodeForBotToken(code: string) {
  const config = getSlackOAuthConfig();
  const response = await fetch(SLACK_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  const body = (await response.json()) as SlackOAuthResponse;

  if (!response.ok || !body.ok || !body.access_token || !body.team?.id) {
    throw new Error(
      `Slack OAuth exchange failed${body.error ? `: ${body.error}` : ""}`,
    );
  }

  return {
    botToken: body.access_token,
    installerUserId: body.authed_user?.id ?? null,
    scopeCsv: body.scope ?? "",
    slackBotUserId: body.bot_user_id ?? null,
    teamId: body.team.id,
    teamName: body.team.name ?? null,
  };
}
