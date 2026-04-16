const SLACK_USERS_LIST_URL = "https://slack.com/api/users.list"
const SLACK_CONVERSATIONS_LIST_URL = "https://slack.com/api/conversations.list"

type SlackPaginatedResponse = {
  error?: string
  ok: boolean
  response_metadata?: {
    next_cursor?: string
  }
}

type SlackUser = {
  deleted?: boolean
  id?: string
  is_bot?: boolean
  name?: string
  profile?: {
    display_name?: string
    email?: string
    image_192?: string
    real_name?: string
  }
  real_name?: string
}

type SlackUsersListResponse = SlackPaginatedResponse & {
  members?: SlackUser[]
}

type SlackConversation = {
  id?: string
  is_archived?: boolean
  is_channel?: boolean
  is_group?: boolean
  is_member?: boolean
  name?: string
  num_members?: number
  purpose?: {
    value?: string
  }
  topic?: {
    value?: string
  }
}

type SlackConversationsListResponse = SlackPaginatedResponse & {
  channels?: SlackConversation[]
}

export async function fetchSlackMessagingDirectory(botToken: string) {
  const [users, conversations] = await Promise.all([
    fetchAllSlackUsers(botToken),
    fetchAllSlackConversations(botToken),
  ])

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
      memberType: user.is_bot ? ("bot" as const) : ("user" as const),
      profileJson: user,
      username: user.name ?? null,
    })),
  }
}

async function fetchAllSlackUsers(botToken: string) {
  return fetchSlackPages<SlackUser, SlackUsersListResponse>({
    botToken,
    endpoint: SLACK_USERS_LIST_URL,
    getItems: (body) => body.members ?? [],
    responseParser: (body) => body as SlackUsersListResponse,
  })
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
  })
}

async function fetchSlackPages<
  Item,
  ResponseType extends SlackPaginatedResponse,
>(input: {
  botToken: string
  endpoint: string
  getItems: (body: ResponseType) => Item[]
  query?: Record<string, string>
  responseParser: (body: unknown) => ResponseType
}) {
  const items: Item[] = []
  let cursor = ""

  do {
    const url = new URL(input.endpoint)

    for (const [key, value] of Object.entries(input.query ?? {})) {
      url.searchParams.set(key, value)
    }

    if (cursor) {
      url.searchParams.set("cursor", cursor)
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${input.botToken}`,
      },
    })
    const body = input.responseParser(await response.json())

    if (!response.ok || !body.ok) {
      throw new Error(
        `Slack API request failed${body.error ? `: ${body.error}` : ""}`,
      )
    }

    items.push(...input.getItems(body))
    cursor = body.response_metadata?.next_cursor?.trim() ?? ""
  } while (cursor)

  return items
}

function getSlackConversationType(conversation: SlackConversation) {
  if (conversation.is_channel) {
    return "public_channel"
  }

  if (conversation.is_group) {
    return "private_channel"
  }

  return "channel"
}
