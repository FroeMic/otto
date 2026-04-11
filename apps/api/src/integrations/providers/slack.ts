const SLACK_CONVERSATIONS_JOIN_URL = "https://slack.com/api/conversations.join"
const SLACK_CONVERSATIONS_LEAVE_URL =
  "https://slack.com/api/conversations.leave"

interface SlackConversationMutationResponse {
  error?: string
  ok: boolean
}

export async function joinSlackChannel(input: {
  botToken: string
  channelId: string
}) {
  return postSlackConversationMutation({
    botToken: input.botToken,
    channelId: input.channelId,
    endpoint: SLACK_CONVERSATIONS_JOIN_URL,
    ignoreErrors: new Set(["already_in_channel"]),
  })
}

export async function leaveSlackChannel(input: {
  botToken: string
  channelId: string
}) {
  return postSlackConversationMutation({
    botToken: input.botToken,
    channelId: input.channelId,
    endpoint: SLACK_CONVERSATIONS_LEAVE_URL,
    ignoreErrors: new Set(["not_in_channel"]),
  })
}

async function postSlackConversationMutation(input: {
  botToken: string
  channelId: string
  endpoint: string
  ignoreErrors: Set<string>
}) {
  const response = await fetch(input.endpoint, {
    body: new URLSearchParams({
      channel: input.channelId,
    }),
    headers: {
      Authorization: `Bearer ${input.botToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  })
  const body = (await response.json()) as SlackConversationMutationResponse

  if (!response.ok || (!body.ok && !input.ignoreErrors.has(body.error ?? ""))) {
    throw new Error(
      `Slack API request failed${body.error ? `: ${body.error}` : ""}`,
    )
  }
}
