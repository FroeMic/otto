import { getSlackOAuthConfig } from "@/lib/env";

const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
const SLACK_USERS_LIST_URL = "https://slack.com/api/users.list";
const SLACK_CONVERSATIONS_LIST_URL = "https://slack.com/api/conversations.list";

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

type SlackPaginatedResponse = {
  error?: string;
  ok: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
};

type SlackUser = {
  deleted?: boolean;
  id?: string;
  is_bot?: boolean;
  name?: string;
  profile?: {
    display_name?: string;
    email?: string;
    image_192?: string;
    real_name?: string;
  };
  real_name?: string;
};

type SlackUsersListResponse = SlackPaginatedResponse & {
  members?: SlackUser[];
};

type SlackConversation = {
  id?: string;
  is_archived?: boolean;
  is_channel?: boolean;
  is_group?: boolean;
  name?: string;
  purpose?: {
    value?: string;
  };
  topic?: {
    value?: string;
  };
};

type SlackConversationsListResponse = SlackPaginatedResponse & {
  channels?: SlackConversation[];
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

export async function fetchSlackMessagingDirectory(botToken: string) {
  const [users, conversations] = await Promise.all([
    fetchAllSlackUsers(botToken),
    fetchAllSlackConversations(botToken),
  ]);

  return {
    conversations: conversations.map((conversation) => ({
      conversationType: getSlackConversationType(conversation),
      externalConversationId: conversation.id ?? "",
      isArchived: Boolean(conversation.is_archived),
      metadataJson: conversation,
      name: conversation.name ?? null,
      purpose: conversation.purpose?.value ?? null,
      topic: conversation.topic?.value ?? null,
    })),
    members: users.map((user) => ({
      avatarUrl: user.profile?.image_192 ?? null,
      displayName: user.profile?.display_name || user.name || null,
      email: user.profile?.email ?? null,
      externalMemberId: user.id ?? "",
      fullName: user.profile?.real_name || user.real_name || null,
      isDeleted: Boolean(user.deleted),
      memberType: user.is_bot ? "bot" : "user",
      profileJson: user,
      username: user.name ?? null,
    })),
  };
}

async function fetchAllSlackUsers(botToken: string) {
  return fetchSlackPages<SlackUser, SlackUsersListResponse>({
    botToken,
    endpoint: SLACK_USERS_LIST_URL,
    getItems: (body) => body.members ?? [],
    responseParser: (body) => body as SlackUsersListResponse,
  });
}

async function fetchAllSlackConversations(botToken: string) {
  return fetchSlackPages<SlackConversation, SlackConversationsListResponse>({
    botToken,
    endpoint: SLACK_CONVERSATIONS_LIST_URL,
    getItems: (body) => body.channels ?? [],
    query: {
      exclude_archived: "false",
      limit: "200",
      types: "public_channel,private_channel",
    },
    responseParser: (body) => body as SlackConversationsListResponse,
  });
}

async function fetchSlackPages<
  Item,
  ResponseType extends SlackPaginatedResponse,
>(input: {
  botToken: string;
  endpoint: string;
  getItems: (body: ResponseType) => Item[];
  query?: Record<string, string>;
  responseParser: (body: unknown) => ResponseType;
}) {
  const items: Item[] = [];
  let cursor = "";

  do {
    const url = new URL(input.endpoint);

    for (const [key, value] of Object.entries(input.query ?? {})) {
      url.searchParams.set(key, value);
    }

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${input.botToken}`,
      },
    });
    const body = input.responseParser(await response.json());

    if (!response.ok || !body.ok) {
      throw new Error(
        `Slack API request failed${body.error ? `: ${body.error}` : ""}`,
      );
    }

    items.push(...input.getItems(body));

    cursor = body.response_metadata?.next_cursor?.trim() ?? "";
  } while (cursor);

  return items;
}

function getSlackConversationType(conversation: SlackConversation) {
  if (conversation.is_group) {
    return "private_channel";
  }

  if (conversation.is_channel) {
    return "channel";
  }

  return "conversation";
}
