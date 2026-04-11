import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { jobEvents, jobRuns } from "@otto/feature-integrations-runtime/db/schema"
import { and, asc, eq, lte, or, sql } from "drizzle-orm"

const WORKSPACE_CHAT_BRIDGE_COMMAND_TYPE = "conversation.trigger_message" as const
const WORKSPACE_CHAT_BRIDGE_JOB_TYPE = "workspace_chat_bridge_dispatch" as const
const COMMAND_CLAIM_STALE_AFTER_MS = 2 * 60 * 1000

export type WorkspaceChatBridgeCommandPayload = {
  commandType: typeof WORKSPACE_CHAT_BRIDGE_COMMAND_TYPE
  conversationId: string
  message: string
  tenantId: string
}

export async function enqueueWorkspaceChatBridgeCommand(input: {
  conversationId: string
  message: string
  tenantId: string
}) {
  const db = getDb()
  const payload: WorkspaceChatBridgeCommandPayload = {
    commandType: WORKSPACE_CHAT_BRIDGE_COMMAND_TYPE,
    conversationId: input.conversationId,
    message: input.message,
    tenantId: input.tenantId,
  }

  const [createdJob] = await db
    .insert(jobRuns)
    .values({
      availableAt: new Date(),
      jobType: WORKSPACE_CHAT_BRIDGE_JOB_TYPE,
      payloadJson: payload,
      status: "queued",
      tenantId: input.tenantId,
    })
    .returning({
      id: jobRuns.id,
    })

  if (!createdJob) {
    throw new Error("Failed to enqueue workspace chat bridge command.")
  }

  await db.insert(jobEvents).values({
    dataJson: {
      commandType: payload.commandType,
      conversationId: payload.conversationId,
    },
    eventType: "queued",
    jobRunId: createdJob.id,
    message: "Workspace chat bridge command queued",
  })

  return {
    commandId: createdJob.id,
    status: "queued" as const,
  }
}

export async function claimNextTenantRuntimeBridgeCommand(input: {
  bridgeId: string
  tenantId: string
}) {
  const db = getDb()
  const staleCutoff = new Date(Date.now() - COMMAND_CLAIM_STALE_AFTER_MS)

  const [candidate] = await db
    .select({
      id: jobRuns.id,
      payload: jobRuns.payloadJson,
    })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.jobType, WORKSPACE_CHAT_BRIDGE_JOB_TYPE),
        eq(jobRuns.tenantId, input.tenantId),
        or(
          and(eq(jobRuns.status, "queued"), lte(jobRuns.availableAt, new Date())),
          and(eq(jobRuns.status, "running"), lte(jobRuns.startedAt, staleCutoff)),
        ),
      ),
    )
    .orderBy(asc(jobRuns.availableAt), asc(jobRuns.createdAt))
    .limit(1)

  if (!candidate) {
    return {
      command: null,
      tenantId: input.tenantId,
    }
  }

  const [claimedJob] = await db
    .update(jobRuns)
    .set({
      attempt: sql`${jobRuns.attempt} + 1`,
      error: null,
      startedAt: new Date(),
      status: "running",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobRuns.id, candidate.id),
        or(eq(jobRuns.status, "queued"), eq(jobRuns.status, "running")),
      ),
    )
    .returning({
      id: jobRuns.id,
      payload: jobRuns.payloadJson,
    })

  if (!claimedJob) {
    return {
      command: null,
      tenantId: input.tenantId,
    }
  }

  const payload = parseWorkspaceChatBridgeCommandPayload(claimedJob.payload)

  await db.insert(jobEvents).values({
    dataJson: {
      bridgeId: input.bridgeId,
      commandType: payload.commandType,
      conversationId: payload.conversationId,
    },
    eventType: "running",
    jobRunId: claimedJob.id,
    message: "Tenant bridge claimed workspace chat command",
  })

  return {
    command: {
      commandId: claimedJob.id,
      commandType: payload.commandType,
      payload: {
        conversationId: payload.conversationId,
        message: payload.message,
      },
    },
    tenantId: input.tenantId,
  }
}

export async function completeTenantRuntimeBridgeCommand(input: {
  commandId: string
  result: {
    completedAt?: string
    error?: string
    exitCode?: number
    status: "failed" | "succeeded"
    stderr?: string
    stdout?: string
  }
  tenantId: string
}) {
  const db = getDb()
  const completedAt = parseOptionalDate(input.result.completedAt) ?? new Date()

  const [updatedJob] = await db
    .update(jobRuns)
    .set({
      error:
        input.result.status === "failed"
          ? input.result.error?.trim() || "Workspace chat bridge command failed."
          : null,
      finishedAt: completedAt,
      status: input.result.status === "succeeded" ? "succeeded" : "failed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobRuns.id, input.commandId),
        eq(jobRuns.jobType, WORKSPACE_CHAT_BRIDGE_JOB_TYPE),
        eq(jobRuns.tenantId, input.tenantId),
      ),
    )
    .returning({
      id: jobRuns.id,
      status: jobRuns.status,
    })

  if (!updatedJob) {
    throw new Error("Bridge command not found.")
  }

  await db.insert(jobEvents).values({
    dataJson: {
      error: input.result.error ?? null,
      exitCode: input.result.exitCode ?? null,
      stderr: input.result.stderr ?? null,
      stdout: input.result.stdout ?? null,
    },
    eventType: input.result.status === "succeeded" ? "succeeded" : "failed",
    jobRunId: input.commandId,
    message:
      input.result.status === "succeeded"
        ? "Tenant bridge completed workspace chat command"
        : input.result.error?.trim() || "Tenant bridge failed workspace chat command",
  })

  return {
    commandId: updatedJob.id,
    status: updatedJob.status,
    tenantId: input.tenantId,
  }
}

function parseWorkspaceChatBridgeCommandPayload(
  value: unknown,
): WorkspaceChatBridgeCommandPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Workspace chat bridge command payload is invalid.")
  }

  const record = value as Record<string, unknown>

  const commandType =
    typeof record.commandType === "string" ? record.commandType.trim() : ""
  const conversationId =
    typeof record.conversationId === "string" ? record.conversationId.trim() : ""
  const message = typeof record.message === "string" ? record.message.trim() : ""
  const tenantId = typeof record.tenantId === "string" ? record.tenantId.trim() : ""

  if (commandType !== WORKSPACE_CHAT_BRIDGE_COMMAND_TYPE) {
    throw new Error(`Unsupported bridge command type: ${commandType || "unknown"}`)
  }

  if (!conversationId || !message || !tenantId) {
    throw new Error("Workspace chat bridge command payload is incomplete.")
  }

  return {
    commandType,
    conversationId,
    message,
    tenantId,
  }
}

function parseOptionalDate(value: string | undefined) {
  if (!value?.trim()) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const __testing = {
  COMMAND_CLAIM_STALE_AFTER_MS,
  WORKSPACE_CHAT_BRIDGE_COMMAND_TYPE,
  WORKSPACE_CHAT_BRIDGE_JOB_TYPE,
  parseWorkspaceChatBridgeCommandPayload,
}
