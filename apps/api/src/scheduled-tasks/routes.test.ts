import assert from "node:assert/strict"

import { WorkspaceSessionAuthError } from "@otto/auth"
import { Hono } from "hono"
import { describe, it } from "vitest"

import {
  createScheduledTasksRouter,
  type ScheduledTasksRouteDependencies,
} from "./routes"

const user = {
  email: "test@getyourotto.com",
  firstName: "Test",
  id: "user_123",
  lastName: "User",
}

function createDependencies(): ScheduledTasksRouteDependencies {
  return {
    authenticateWorkspaceUser: async () => user,
    getWorkspaceScheduledTaskDetail: async () => ({
      dateTimePreferences: {
        locale: "en-US",
        timeFormatPreference: "24",
        timeZone: "Europe/Berlin",
      },
      latestRefreshJob: {
        createdAt: "2026-04-12T12:00:00.000Z",
        error: null,
        finishedAt: "2026-04-12T12:00:10.000Z",
        id: "job_refresh_123",
        startedAt: "2026-04-12T12:00:01.000Z",
        status: "succeeded",
      },
      latestSyncedAt: "2026-04-12T12:00:10.000Z",
      runs: [
        {
          error: null,
          externalSessionId: "session_123",
          finishedAt: "2026-04-12T12:06:00.000Z",
          hasSyncedSession: true,
          id: "run_123",
          runtimeSessionKey: "agent:main:cron:nightly",
          scheduledFor: "2026-04-12T12:05:00.000Z",
          startedAt: "2026-04-12T12:05:10.000Z",
          status: "succeeded",
          summary: "Completed nightly task",
          taskKey: "nightly",
          taskName: "Nightly",
          triggerType: "scheduled",
        },
      ],
      state: "ready",
      task: {
        agentId: "agent_123",
        deleteAfterRun: false,
        deliveryJson: null,
        description: "Nightly deploy check",
        enabled: true,
        failureAlertJson: null,
        id: "task_123",
        lastError: null,
        lastRunAt: "2026-04-12T12:06:00.000Z",
        lastRunStatus: "succeeded",
        lastSyncError: null,
        lastSyncedAt: "2026-04-12T12:00:10.000Z",
        name: "Nightly",
        nextRunAt: "2026-04-13T12:05:00.000Z",
        payloadJson: {
          kind: "agentTurn",
          message: "Check deploy status",
        },
        scheduleExpression: "5 12 * * * (Europe/Berlin)",
        scheduleJson: {
          expr: "5 12 * * *",
          kind: "cron",
          tz: "Europe/Berlin",
        },
        scheduleKind: "cron",
        sessionKey: "agent:main:cron:nightly",
        sessionTarget: "main",
        status: "active",
        taskKey: "nightly",
        timezone: "Europe/Berlin",
        updatedAt: "2026-04-12T12:00:10.000Z",
        wakeMode: "wake",
      },
    }),
    listWorkspaceScheduledTaskRuns: async () => ({
      dateTimePreferences: {
        locale: "en-US",
        timeFormatPreference: "24",
        timeZone: "Europe/Berlin",
      },
      latestRefreshJob: {
        createdAt: "2026-04-12T12:00:00.000Z",
        error: null,
        finishedAt: "2026-04-12T12:00:10.000Z",
        id: "job_refresh_123",
        startedAt: "2026-04-12T12:00:01.000Z",
        status: "succeeded",
      },
      latestSyncedAt: "2026-04-12T12:00:10.000Z",
      runs: [
        {
          error: null,
          externalSessionId: "session_123",
          finishedAt: "2026-04-12T12:06:00.000Z",
          hasSyncedSession: true,
          id: "run_123",
          runtimeSessionKey: "agent:main:cron:nightly",
          scheduledFor: "2026-04-12T12:05:00.000Z",
          startedAt: "2026-04-12T12:05:10.000Z",
          status: "succeeded",
          summary: "Completed nightly task",
          taskKey: "nightly",
          taskName: "Nightly",
          triggerType: "scheduled",
        },
      ],
      state: "ready",
    }),
    listWorkspaceScheduledTasks: async () => ({
      dateTimePreferences: {
        locale: "en-US",
        timeFormatPreference: "24",
        timeZone: "Europe/Berlin",
      },
      latestRefreshJob: {
        createdAt: "2026-04-12T12:00:00.000Z",
        error: null,
        finishedAt: "2026-04-12T12:00:10.000Z",
        id: "job_refresh_123",
        startedAt: "2026-04-12T12:00:01.000Z",
        status: "succeeded",
      },
      latestSyncedAt: "2026-04-12T12:00:10.000Z",
      state: "ready",
      tasks: [
        {
          agentId: "agent_123",
          deleteAfterRun: false,
          deliveryJson: null,
          description: "Nightly deploy check",
          enabled: true,
          failureAlertJson: null,
          id: "task_123",
          lastError: null,
          lastRunAt: "2026-04-12T12:06:00.000Z",
          lastRunStatus: "succeeded",
          lastSyncError: null,
          lastSyncedAt: "2026-04-12T12:00:10.000Z",
          name: "Nightly",
          nextRunAt: "2026-04-13T12:05:00.000Z",
          payloadJson: null,
          scheduleExpression: "5 12 * * * (Europe/Berlin)",
          scheduleJson: {
            expr: "5 12 * * *",
            kind: "cron",
            tz: "Europe/Berlin",
          },
          scheduleKind: "cron",
          sessionKey: "agent:main:cron:nightly",
          sessionTarget: "main",
          status: "active",
          taskKey: "nightly",
          timezone: "Europe/Berlin",
          updatedAt: "2026-04-12T12:00:10.000Z",
          wakeMode: "wake",
        },
      ],
    }),
    refreshWorkspaceScheduledTasks: async () => ({
      jobId: "job_refresh_123",
      ok: true,
    }),
  }
}

function createScheduledTasksTestApp(
  dependencies: ScheduledTasksRouteDependencies = createDependencies(),
) {
  const app = new Hono()
  app.route("/", createScheduledTasksRouter(dependencies))

  return app
}

describe("scheduled tasks routes", () => {
  it("returns the workspace scheduled tasks overview payload", async () => {
    const app = createScheduledTasksTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/scheduled-tasks/tasks",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      dateTimePreferences: {
        locale: "en-US",
        timeFormatPreference: "24",
        timeZone: "Europe/Berlin",
      },
      latestRefreshJob: {
        createdAt: "2026-04-12T12:00:00.000Z",
        error: null,
        finishedAt: "2026-04-12T12:00:10.000Z",
        id: "job_refresh_123",
        startedAt: "2026-04-12T12:00:01.000Z",
        status: "succeeded",
      },
      latestSyncedAt: "2026-04-12T12:00:10.000Z",
      state: "ready",
      tasks: [
        {
          agentId: "agent_123",
          deleteAfterRun: false,
          deliveryJson: null,
          description: "Nightly deploy check",
          enabled: true,
          failureAlertJson: null,
          id: "task_123",
          lastError: null,
          lastRunAt: "2026-04-12T12:06:00.000Z",
          lastRunStatus: "succeeded",
          lastSyncError: null,
          lastSyncedAt: "2026-04-12T12:00:10.000Z",
          name: "Nightly",
          nextRunAt: "2026-04-13T12:05:00.000Z",
          payloadJson: null,
          scheduleExpression: "5 12 * * * (Europe/Berlin)",
          scheduleJson: {
            expr: "5 12 * * *",
            kind: "cron",
            tz: "Europe/Berlin",
          },
          scheduleKind: "cron",
          sessionKey: "agent:main:cron:nightly",
          sessionTarget: "main",
          status: "active",
          taskKey: "nightly",
          timezone: "Europe/Berlin",
          updatedAt: "2026-04-12T12:00:10.000Z",
          wakeMode: "wake",
        },
      ],
    })
  })

  it("returns the workspace scheduled task runs payload", async () => {
    const app = createScheduledTasksTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/scheduled-tasks/task-runs",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      dateTimePreferences: {
        locale: "en-US",
        timeFormatPreference: "24",
        timeZone: "Europe/Berlin",
      },
      latestRefreshJob: {
        createdAt: "2026-04-12T12:00:00.000Z",
        error: null,
        finishedAt: "2026-04-12T12:00:10.000Z",
        id: "job_refresh_123",
        startedAt: "2026-04-12T12:00:01.000Z",
        status: "succeeded",
      },
      latestSyncedAt: "2026-04-12T12:00:10.000Z",
      runs: [
        {
          error: null,
          externalSessionId: "session_123",
          finishedAt: "2026-04-12T12:06:00.000Z",
          hasSyncedSession: true,
          id: "run_123",
          runtimeSessionKey: "agent:main:cron:nightly",
          scheduledFor: "2026-04-12T12:05:00.000Z",
          startedAt: "2026-04-12T12:05:10.000Z",
          status: "succeeded",
          summary: "Completed nightly task",
          taskKey: "nightly",
          taskName: "Nightly",
          triggerType: "scheduled",
        },
      ],
      state: "ready",
    })
  })

  it("returns the workspace scheduled task detail payload", async () => {
    const app = createScheduledTasksTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/scheduled-tasks/tasks/nightly",
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      dateTimePreferences: {
        locale: "en-US",
        timeFormatPreference: "24",
        timeZone: "Europe/Berlin",
      },
      latestRefreshJob: {
        createdAt: "2026-04-12T12:00:00.000Z",
        error: null,
        finishedAt: "2026-04-12T12:00:10.000Z",
        id: "job_refresh_123",
        startedAt: "2026-04-12T12:00:01.000Z",
        status: "succeeded",
      },
      latestSyncedAt: "2026-04-12T12:00:10.000Z",
      runs: [
        {
          error: null,
          externalSessionId: "session_123",
          finishedAt: "2026-04-12T12:06:00.000Z",
          hasSyncedSession: true,
          id: "run_123",
          runtimeSessionKey: "agent:main:cron:nightly",
          scheduledFor: "2026-04-12T12:05:00.000Z",
          startedAt: "2026-04-12T12:05:10.000Z",
          status: "succeeded",
          summary: "Completed nightly task",
          taskKey: "nightly",
          taskName: "Nightly",
          triggerType: "scheduled",
        },
      ],
      state: "ready",
      task: {
        agentId: "agent_123",
        deleteAfterRun: false,
        deliveryJson: null,
        description: "Nightly deploy check",
        enabled: true,
        failureAlertJson: null,
        id: "task_123",
        lastError: null,
        lastRunAt: "2026-04-12T12:06:00.000Z",
        lastRunStatus: "succeeded",
        lastSyncError: null,
        lastSyncedAt: "2026-04-12T12:00:10.000Z",
        name: "Nightly",
        nextRunAt: "2026-04-13T12:05:00.000Z",
        payloadJson: {
          kind: "agentTurn",
          message: "Check deploy status",
        },
        scheduleExpression: "5 12 * * * (Europe/Berlin)",
        scheduleJson: {
          expr: "5 12 * * *",
          kind: "cron",
          tz: "Europe/Berlin",
        },
        scheduleKind: "cron",
        sessionKey: "agent:main:cron:nightly",
        sessionTarget: "main",
        status: "active",
        taskKey: "nightly",
        timezone: "Europe/Berlin",
        updatedAt: "2026-04-12T12:00:10.000Z",
        wakeMode: "wake",
      },
    })
  })

  it("queues a scheduled tasks refresh job", async () => {
    const app = createScheduledTasksTestApp()
    const response = await app.request(
      "http://api.local/api/workspace/otto/scheduled-tasks/refresh",
      {
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      jobId: "job_refresh_123",
      ok: true,
    })
  })

  it("returns 401 when the workspace session is missing", async () => {
    const app = createScheduledTasksTestApp({
      ...createDependencies(),
      authenticateWorkspaceUser: async () => {
        throw new WorkspaceSessionAuthError(
          "missing_workspace_session",
          "Missing workspace session",
        )
      },
    })
    const response = await app.request(
      "http://api.local/api/workspace/otto/scheduled-tasks/tasks",
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      code: "missing_workspace_session",
      message: "Missing workspace session",
    })
  })

  it("returns 404 when the scheduled task is missing", async () => {
    const app = createScheduledTasksTestApp({
      ...createDependencies(),
      getWorkspaceScheduledTaskDetail: async () => null,
    })
    const response = await app.request(
      "http://api.local/api/workspace/otto/scheduled-tasks/tasks/missing",
    )

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), {
      code: "scheduled_task_not_found",
      message: "Scheduled task not found",
    })
  })
})
