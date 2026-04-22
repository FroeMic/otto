import { describe, expect, it } from "vitest"

import { __testing } from "./queries"

describe("session query helpers", () => {
  it("filters base cron placeholders when run-specific sessions exist", () => {
    const baseCronKey = "agent:main:cron:job-1"
    const runCronKey = `${baseCronKey}:run:run-1`
    const workspaceChatKey =
      "agent:main:otto-workspace-chat:channel:workspace:conversation-1"
    const rows = __testing.selectVisibleSessionRows([
      {
        lastMessageAt: 1776860480814,
        messageCount: 2,
        sessionKey: baseCronKey,
      },
      {
        lastMessageAt: 1776860490000,
        messageCount: 4,
        sessionKey: runCronKey,
      },
      {
        lastMessageAt: 1776860500000,
        messageCount: 56,
        sessionKey: workspaceChatKey,
      },
    ])

    expect(rows.map((row) => row.sessionKey)).toEqual([
      runCronKey,
      workspaceChatKey,
    ])
  })

  it("filters empty placeholder sessions from the sessions list", () => {
    const failedWorkspaceChatKey =
      "agent:main:otto-workspace-chat:channel:workspace:failed-conversation"
    const activeWorkspaceChatKey =
      "agent:main:otto-workspace-chat:channel:workspace:active-conversation"
    const rows = __testing.selectVisibleSessionRows([
      {
        lastMessageAt: null,
        messageCount: null,
        sessionKey: failedWorkspaceChatKey,
      },
      {
        lastMessageAt: 1776860500000,
        messageCount: 56,
        sessionKey: activeWorkspaceChatKey,
      },
    ])

    expect(rows.map((row) => row.sessionKey)).toEqual([activeWorkspaceChatKey])
  })
})
