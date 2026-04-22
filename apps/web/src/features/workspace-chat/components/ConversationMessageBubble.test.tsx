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

function buildMixedUserVoiceNoteMessage(): WorkspaceChatMessage {
  return {
    author: {
      kind: "user",
      name: "User",
      userId: "user_1",
    },
    createdAt: "2026-04-21T10:31:00.000Z",
    id: "message_3",
    parts: [
      {
        text: "Please process these.",
        type: "text",
      },
      {
        attachmentId: "attachment_1",
        durationMs: 9000,
        mimeType: "audio/webm",
        transcript: "First voice note transcript with enough words.",
        type: "audio",
      },
      {
        attachmentId: "attachment_2",
        durationMs: 11_000,
        mimeType: "audio/webm",
        transcript: "Second voice note transcript with different words.",
        type: "audio",
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

  it("renders user bubbles with the original flat background styling", () => {
    const markup = renderToStaticMarkup(
      <ConversationMessageBubble
        currentUserId="user_1"
        events={[]}
        message={buildUserMessage("Flat bubble please.")}
        orgSlug="acme"
      />,
    )

    const bubbleClass =
      markup.match(/class="[^"]*bg-secondary[^"]*"/)?.[0] ?? ""

    assert.notEqual(bubbleClass, "")
    assert.equal(bubbleClass.includes("shadow-sm"), false)
    assert.equal(bubbleClass.includes("border-primary"), false)
    assert.equal(bubbleClass.includes("border-transparent"), false)
  })

  it("renders other-user bubbles without border or shadow", () => {
    const markup = renderToStaticMarkup(
      <ConversationMessageBubble
        currentUserId="another_user"
        events={[]}
        message={buildUserMessage("Also flat.")}
        orgSlug="acme"
      />,
    )

    const bubbleClass =
      markup.match(/class="[^"]*bg-muted\/65[^"]*"/)?.[0] ?? ""

    assert.notEqual(bubbleClass, "")
    assert.equal(bubbleClass.includes("shadow-sm"), false)
    assert.equal(bubbleClass.includes("border-border"), false)
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

  it("renders voice-note transcript previews in stacked expandable rows", () => {
    const markup = renderToStaticMarkup(
      <ConversationMessageBubble
        currentUserId="user_1"
        events={[]}
        message={buildMixedUserVoiceNoteMessage()}
        orgSlug="acme"
      />,
    )

    assert.match(markup, /Please process these\./)
    assert.match(markup, /First voice note transcript/)
    assert.match(markup, /Second voice note transcript/)
    assert.match(markup, /aria-expanded="false"/)
    assert.equal(markup.includes("with enough words."), false)
    assert.equal(markup.includes("with different words."), false)
  })
})
