import assert from "node:assert/strict"

import { WorkspaceSessionAuthError } from "@otto/auth"
import { Hono } from "hono"
import { describe, it } from "vitest"

import { createSessionsRouter, type SessionsRouteDependencies } from "./routes"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

function createDependencies(): SessionsRouteDependencies {
  return {
    authenticateWorkspaceUser: async () => user,
    getWorkspaceSessionDetail: async () => ({
      channelNames: {
        C123: "deployments",
      },
      cronTaskHref: "/otto/scheduled-tasks/tasks/nightly",
      currentUserExternalIds: ["U123"],
      dateTimePreferences: {
        locale: "en-US",
        timeFormatPreference: "24",
        timeZone: "Europe/Berlin",
      },
      memberNames: {
        U123: "Michael",
      },
      session: {
        channel: "slack",
        channelProvider: "slack",
        chatType: "dm",
        displayName: "Deploy Check",
        endedAt: "2026-04-12T12:06:00.000Z",
        estimatedCostUsd: "0.0123",
        externalSessionId: "session_123",
        id: "tenant_session_123",
        inputTokens: 1200,
        label: "Deploy Check",
        lastSyncedAt: "2026-04-12T12:06:01.000Z",
        messageCount: 12,
        model: "gpt-5.4",
        modelProvider: "openai",
        originFrom: "U123",
        runtimeMs: 22_000,
        sessionKey: "agent:main:slack:dm:U123",
        startedAt: "2026-04-12T12:05:00.000Z",
        status: "done",
        subject: "Deploy status",
        totalTokens: 2400,
        transcriptJsonl: '{"type":"message"}',
      },
      state: "ready",
    }),
    hasPlatformAdminRole: async () => false,
    listWorkspaceSessions: async () => ({
      channelNames: {
        C123: "deployments",
      },
      cronTaskKeys: {
        "agent:main:cron:nightly:run:1": "nightly",
      },
      currentUserExternalIds: ["U123"],
      dateTimePreferences: {
        locale: "en-US",
        timeFormatPreference: "24",
        timeZone: "Europe/Berlin",
      },
      memberNames: {
        U123: "Michael",
      },
      sessions: [
        {
          createdAt: "2026-04-12T12:05:00.000Z",
          displayName: "Deploy Check",
          endedAt: "2026-04-12T12:06:00.000Z",
          estimatedCostUsd: "0.0123",
          externalSessionId: "session_123",
          id: "tenant_session_123",
          inputTokens: 1200,
          label: "Deploy Check",
          lastMessageAt: 1_744_460_000_000,
          lastSyncedAt: "2026-04-12T12:06:01.000Z",
          messageCount: 12,
          model: "gpt-5.4",
          modelProvider: "openai",
          originFrom: "U123",
          parentSessionKey: null,
          runtimeMs: 22_000,
          sessionKey: "agent:main:slack:dm:U123",
          sessionUpdatedAt: 1_744_460_000_000,
          spawnDepth: 0,
          startedAt: "2026-04-12T12:05:00.000Z",
          status: "done",
          subject: "Deploy status",
          subagentRole: null,
          totalTokens: 2400,
        },
      ],
      state: "ready",
    }),
    refreshWorkspaceSessions: async () => ({
      jobId: "job_sync_123",
      ok: true,
    }),
  }
}

function createSessionsTestApp(
  dependencies: SessionsRouteDependencies = createDependencies(),
) {
  const app = new Hono()
  app.route("/", createSessionsRouter(dependencies))

  return app
}

describe("sessions routes", () => {
  it("returns the workspace sessions overview payload", async () => {
    const app = createSessionsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/sessions",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      channelNames: {
        C123: "deployments",
      },
      cronTaskKeys: {
        "agent:main:cron:nightly:run:1": "nightly",
      },
      currentUserExternalIds: ["U123"],
      dateTimePreferences: {
        locale: "en-US",
        timeFormatPreference: "24",
        timeZone: "Europe/Berlin",
      },
      memberNames: {
        U123: "Michael",
      },
      sessions: [
        {
          createdAt: "2026-04-12T12:05:00.000Z",
          displayName: "Deploy Check",
          endedAt: "2026-04-12T12:06:00.000Z",
          estimatedCostUsd: "0.0123",
          externalSessionId: "session_123",
          id: "tenant_session_123",
          inputTokens: 1200,
          label: "Deploy Check",
          lastMessageAt: 1744460000000,
          lastSyncedAt: "2026-04-12T12:06:01.000Z",
          messageCount: 12,
          model: "gpt-5.4",
          modelProvider: "openai",
          originFrom: "U123",
          parentSessionKey: null,
          runtimeMs: 22000,
          sessionKey: "agent:main:slack:dm:U123",
          sessionUpdatedAt: 1744460000000,
          spawnDepth: 0,
          startedAt: "2026-04-12T12:05:00.000Z",
          status: "done",
          subject: "Deploy status",
          subagentRole: null,
          totalTokens: 2400,
        },
      ],
      state: "ready",
    })
  })

  it("returns the workspace session detail payload", async () => {
    const app = createSessionsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/sessions/agent%3Amain%3Aslack%3Adm%3AU123",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      channelNames: {
        C123: "deployments",
      },
      cronTaskHref: "/otto/scheduled-tasks/tasks/nightly",
      currentUserExternalIds: ["U123"],
      dateTimePreferences: {
        locale: "en-US",
        timeFormatPreference: "24",
        timeZone: "Europe/Berlin",
      },
      memberNames: {
        U123: "Michael",
      },
      session: {
        channel: "slack",
        channelProvider: "slack",
        chatType: "dm",
        displayName: "Deploy Check",
        endedAt: "2026-04-12T12:06:00.000Z",
        estimatedCostUsd: "0.0123",
        externalSessionId: "session_123",
        id: "tenant_session_123",
        inputTokens: 1200,
        label: "Deploy Check",
        lastSyncedAt: "2026-04-12T12:06:01.000Z",
        messageCount: 12,
        model: "gpt-5.4",
        modelProvider: "openai",
        originFrom: "U123",
        runtimeMs: 22000,
        sessionKey: "agent:main:slack:dm:U123",
        startedAt: "2026-04-12T12:05:00.000Z",
        status: "done",
        subject: "Deploy status",
        totalTokens: 2400,
        transcriptJsonl: '{"type":"message"}',
      },
      state: "ready",
    })
  })

  it("queues a session refresh job", async () => {
    const app = createSessionsTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/sessions/refresh",
      {
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      jobId: "job_sync_123",
      ok: true,
    })
  })

  it("returns 401 when the workspace session is missing", async () => {
    const app = createSessionsTestApp({
      ...createDependencies(),
      authenticateWorkspaceUser: async () => {
        throw new WorkspaceSessionAuthError(
          "missing_workspace_session",
          "Missing workspace session",
        )
      },
    })
    const response = await app.request(
      "http://api.local/api/workspace/otto/sessions",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "missing_workspace_session",
      message: "Missing workspace session",
    })
  })
})
