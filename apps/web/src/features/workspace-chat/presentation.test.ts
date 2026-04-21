import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  getWorkspaceConversationTurnKind,
  getWorkspaceConversationTurnGroupKey,
  getWorkspaceConversationTurnName,
} from "./presentation"

describe("workspace chat presentation helpers", () => {
  it("classifies assistant, current user, other user, and system turns", () => {
    assert.equal(
      getWorkspaceConversationTurnKind({
        currentUserId: "user_1",
        message: {
          author: {
            kind: "assistant",
          },
          createdAt: "2026-04-13T09:00:00.000Z",
          id: "msg_assistant",
          parts: [],
          status: "completed",
        },
      }),
      "assistant",
    )

    assert.equal(
      getWorkspaceConversationTurnKind({
        currentUserId: "user_1",
        message: {
          author: {
            kind: "user",
            userId: "user_1",
          },
          createdAt: "2026-04-13T09:00:00.000Z",
          id: "msg_self",
          parts: [],
          status: "completed",
        },
      }),
      "current_user",
    )

    assert.equal(
      getWorkspaceConversationTurnKind({
        currentUserId: "user_1",
        message: {
          author: {
            kind: "user",
            userId: "user_2",
          },
          createdAt: "2026-04-13T09:00:00.000Z",
          id: "msg_other",
          parts: [],
          status: "completed",
        },
      }),
      "other_user",
    )

    assert.equal(
      getWorkspaceConversationTurnKind({
        currentUserId: "user_1",
        message: {
          author: {
            kind: "automation",
          },
          createdAt: "2026-04-13T09:00:00.000Z",
          id: "msg_system",
          parts: [],
          status: "completed",
        },
      }),
      "system",
    )
  })

  it("provides stable fallback names for turn kinds", () => {
    assert.equal(
      getWorkspaceConversationTurnName({
        message: {
          author: {
            kind: "assistant",
          },
          createdAt: "2026-04-13T09:00:00.000Z",
          id: "msg_assistant",
          parts: [],
          status: "completed",
        },
        turnKind: "assistant",
      }),
      "Otto",
    )

    assert.equal(
      getWorkspaceConversationTurnName({
        message: {
          author: {
            kind: "user",
          },
          createdAt: "2026-04-13T09:00:00.000Z",
          id: "msg_current_user",
          parts: [],
          status: "completed",
        },
        turnKind: "current_user",
      }),
      "You",
    )
  })

  it("builds group keys from the rendered turn identity", () => {
    const firstMessage = {
      author: {
        kind: "assistant" as const,
      },
      createdAt: "2026-04-13T09:00:00.000Z",
      id: "msg_assistant_1",
      parts: [],
      status: "completed" as const,
    }
    const secondMessage = {
      ...firstMessage,
      id: "msg_assistant_2",
    }

    assert.equal(
      getWorkspaceConversationTurnGroupKey({
        currentUserId: "user_1",
        message: firstMessage,
      }),
      getWorkspaceConversationTurnGroupKey({
        currentUserId: "user_1",
        message: secondMessage,
      }),
    )

    assert.notEqual(
      getWorkspaceConversationTurnGroupKey({
        currentUserId: "user_1",
        message: firstMessage,
      }),
      getWorkspaceConversationTurnGroupKey({
        currentUserId: "user_1",
        message: {
          author: {
            kind: "user",
            name: "Test User",
            userId: "user_1",
          },
          createdAt: "2026-04-13T09:01:00.000Z",
          id: "msg_user",
          parts: [],
          status: "completed",
        },
      }),
    )
  })
})
