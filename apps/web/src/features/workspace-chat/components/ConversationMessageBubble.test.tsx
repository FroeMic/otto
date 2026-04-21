import assert from "node:assert/strict"

import type { WorkspaceChatMessage } from "@otto/feature-workspace-chat"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, it } from "vitest"

import { ConversationMessageBubble } from "./ConversationMessageBubble"

function buildAssistantMessage(text: string): WorkspaceChatMessage {
  return {
    author: {
      kind: "assistant",
      name: "Otto",
    },
    createdAt: "2026-04-21T10:30:00.000Z",
    id: "message_1",
    parts: [
      {
        text,
        type: "text",
      },
    ],
    status: "completed",
  }
}

function buildUserMessage(text: string): WorkspaceChatMessage {
  return {
    author: {
      kind: "user",
      name: "User",
      userId: "user_1",
    },
    createdAt: "2026-04-21T10:31:00.000Z",
    id: "message_2",
    parts: [
      {
        text,
        type: "text",
      },
    ],
    status: "completed",
  }
}

describe("ConversationMessageBubble", () => {
  it("renders assistant text parts as markdown", () => {
    const markup = renderToStaticMarkup(
      <ConversationMessageBubble
        events={[]}
        message={buildAssistantMessage("Here is **bold** text.")}
        orgSlug="acme"
      />,
    )

    assert.match(markup, /data-streamdown="strong"[^>]*>bold<\/span>/)
    assert.equal(markup.includes("**bold**"), false)
  })

  it("keeps user text parts literal", () => {
    const markup = renderToStaticMarkup(
      <ConversationMessageBubble
        currentUserId="user_1"
        events={[]}
        message={buildUserMessage("Please keep **this** literal.")}
        orgSlug="acme"
      />,
    )

    assert.match(markup, /\*\*this\*\*/)
    assert.equal(markup.includes('data-streamdown="strong"'), false)
  })

  it("does not render assistant markdown images or raw html", () => {
    const markup = renderToStaticMarkup(
      <ConversationMessageBubble
        events={[]}
        message={buildAssistantMessage(
          '![tracker](https://example.com/pixel.png)\n<script>alert("x")</script>',
        )}
        orgSlug="acme"
      />,
    )

    assert.equal(markup.includes("<img"), false)
    assert.equal(markup.includes("<script"), false)
  })
})
