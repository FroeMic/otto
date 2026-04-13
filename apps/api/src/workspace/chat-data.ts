import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  tenantSessions,
  tenants,
  users,
  workspaceChatConversations,
  workspaceChatMessageEvents,
  workspaceChatMessageParts,
  workspaceChatMessages,
  workspaceChatRuntimeSegments,
} from "@otto/feature-integrations-runtime/db/schema"
import type {
  WorkspaceChatConversationDetailResponse,
  WorkspaceChatConversationListResponse,
  WorkspaceChatConversationSummary,
  WorkspaceChatMessage,
  WorkspaceChatMessageCreateResponse,
  WorkspaceChatMessageEvent,
  WorkspaceChatMessagePart,
  WorkspaceChatRealtimeEvent,
  WorkspaceChatRuntimeMessageEventMutation,
} from "@otto/feature-workspace-chat"
import { and, desc, eq, inArray, lt, or } from "drizzle-orm"

import { enrichWorkspaceChatMessageEventsWithTranscripts } from "./chat-activity-enrichment"
import { getWorkspaceChatRealtimeHub } from "./chat-realtime-hub"
import { getOrganizationWorkspaceBySlug } from "./data"

type WorkspaceChatConversationRow = {
  id: string
  kind: string
  lastActivityAt: Date
  latestMessagePreview: string | null
  slug: string | null
  tenantId: string
  title: string
  visibility: string
}

type WorkspaceChatMessagePartRecord = {
  attachmentId: string | null
  durationMs: number | null
  fileName: string | null
  mimeType: string | null
  partKind: string
  textValue: string | null
}

type WorkspaceChatMessageRow = {
  authorExternalId: string | null
  authorKind: string
  authorName: string | null
  completedAt: Date | null
  createdAt: Date
  id: string
  status: string
}

type WorkspaceChatMessageEventRow = {
  conversationId: string
  createdAt: Date
  eventType: string
  id: string
  itemId: string | null
  messageId: string
  payloadJson: Record<string, unknown>
  runId: string | null
  runtimeSegmentId: string | null
  sequence: number
  sessionKey: string | null
  status: string | null
  summary: string | null
  title: string | null
}

type WorkspaceChatActor = {
  organizationId: string
  tenantId: string | null
  userId: string
  userExternalId: string
}

const PERSONAL_VISIBILITY = "personal"
const OPEN_VISIBILITY = "open"
const DEFAULT_CONVERSATION_TITLE = "New conversation"
const DEFAULT_CONVERSATION_PAGE_SIZE = 30

type WorkspaceChatConversationCursor = {
  id: string
  lastActivityAt: string
}

export function shouldApplyWorkspaceChatAssistantDeltaSequence(input: {
  incomingSequence: number
  lastAppliedSequence: number
}) {
  return input.incomingSequence > input.lastAppliedSequence
}

export function buildWorkspaceChatMessagePreview(
  parts: WorkspaceChatMessagePart[],
) {
  for (const part of parts) {
    if (part.type === "text") {
      return truncatePreview(part.text)
    }

    if (part.type === "file") {
      return truncatePreview(part.fileName)
    }

    if (part.type === "audio" && part.transcript) {
      return truncatePreview(part.transcript)
    }
  }

  const firstPart = parts[0]

  if (!firstPart) {
    return null
  }

  if (firstPart.type === "audio") {
    return "Voice note"
  }

  return null
}

export function deriveWorkspaceChatConversationOriginKind(
  kind: string,
): WorkspaceChatConversationSummary["originKind"] {
  if (kind === "external_surface") {
    return "trigger"
  }

  if (kind === "durable_named") {
    return "scheduled"
  }

  return "manual"
}

export function shouldAutoGenerateWorkspaceConversationTitle(title: string) {
  return title.trim() === DEFAULT_CONVERSATION_TITLE
}

export function generateWorkspaceConversationTitle(
  parts: WorkspaceChatMessagePart[],
) {
  const preview = buildWorkspaceChatMessagePreview(parts)?.trim()

  if (!preview) {
    return DEFAULT_CONVERSATION_TITLE
  }

  const collapsed = preview.replace(/\s+/g, " ").trim()

  if (!collapsed) {
    return DEFAULT_CONVERSATION_TITLE
  }

  const firstSentence = collapsed.split(/[.!?]\s/)[0]?.trim() ?? collapsed
  const preferred = firstSentence.length > 0 ? firstSentence : collapsed

  if (preferred.length <= 48) {
    return preferred
  }

  const truncated = preferred.slice(0, 45).trimEnd()
  const wordBoundary = truncated.lastIndexOf(" ")
  const safeTruncation =
    wordBoundary >= 24 ? truncated.slice(0, wordBoundary).trimEnd() : truncated

  return `${safeTruncation}...`
}

export function mapWorkspaceChatMessagePartRecord(
  record: WorkspaceChatMessagePartRecord,
): WorkspaceChatMessagePart {
  if (record.partKind === "text") {
    return {
      text: record.textValue ?? "",
      type: "text",
    }
  }

  if (record.partKind === "file") {
    return {
      attachmentId: record.attachmentId ?? "",
      fileName: record.fileName ?? "Attachment",
      mimeType: record.mimeType ?? "application/octet-stream",
      type: "file",
    }
  }

  if (record.partKind === "audio") {
    return {
      attachmentId: record.attachmentId ?? "",
      durationMs: record.durationMs ?? undefined,
      mimeType: record.mimeType ?? "audio/webm",
      transcript: record.textValue ?? undefined,
      type: "audio",
    }
  }

  throw new Error(`Unsupported workspace chat part kind: ${record.partKind}`)
}

export function mapWorkspaceChatMessageEventRecord(
  record: WorkspaceChatMessageEventRow,
): WorkspaceChatMessageEvent {
  return {
    conversationId: record.conversationId,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    itemId: record.itemId ?? undefined,
    messageId: record.messageId,
    payload: record.payloadJson,
    runId: record.runId ?? undefined,
    runtimeSegmentId: record.runtimeSegmentId ?? undefined,
    sequence: record.sequence,
    sessionKey: record.sessionKey ?? undefined,
    status:
      (record.status as WorkspaceChatMessageEvent["status"] | null) ??
      undefined,
    summary: record.summary ?? undefined,
    title: record.title ?? undefined,
    type: record.eventType as WorkspaceChatMessageEvent["type"],
  }
}

export function encodeWorkspaceChatConversationCursor(
  input: WorkspaceChatConversationCursor,
) {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url")
}

export function decodeWorkspaceChatConversationCursor(
  cursor: string,
): WorkspaceChatConversationCursor {
  const raw = Buffer.from(cursor, "base64url").toString("utf8")
  const parsed = JSON.parse(raw) as Partial<WorkspaceChatConversationCursor>

  if (
    typeof parsed.id !== "string" ||
    parsed.id.trim().length === 0 ||
    typeof parsed.lastActivityAt !== "string" ||
    parsed.lastActivityAt.trim().length === 0
  ) {
    throw new Error("Invalid workspace chat conversation cursor.")
  }

  return {
    id: parsed.id,
    lastActivityAt: parsed.lastActivityAt,
  }
}

export async function listWorkspaceChatConversations(input: {
  cursor?: string
  limit?: number
  orgSlug: string
  userExternalId: string
}): Promise<WorkspaceChatConversationListResponse> {
  const actor = await resolveWorkspaceChatActor({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })
  const db = getDb()
  const pageSize = Math.min(
    Math.max(input.limit ?? DEFAULT_CONVERSATION_PAGE_SIZE, 1),
    100,
  )
  const decodedCursor = input.cursor
    ? decodeWorkspaceChatConversationCursor(input.cursor)
    : null
  const cursorDate = decodedCursor
    ? new Date(decodedCursor.lastActivityAt)
    : null

  if (cursorDate && Number.isNaN(cursorDate.getTime())) {
    throw new Error("Invalid workspace chat conversation cursor.")
  }

  const rows = await db
    .select({
      id: workspaceChatConversations.id,
      kind: workspaceChatConversations.kind,
      lastActivityAt: workspaceChatConversations.lastActivityAt,
      latestMessagePreview: workspaceChatConversations.latestMessagePreview,
      slug: workspaceChatConversations.slug,
      tenantId: workspaceChatConversations.tenantId,
      title: workspaceChatConversations.title,
      visibility: workspaceChatConversations.visibility,
    })
    .from(workspaceChatConversations)
    .where(
      and(
        eq(workspaceChatConversations.organizationId, actor.organizationId),
        buildWorkspaceChatConversationAccessPredicate(actor.userId),
        decodedCursor && cursorDate
          ? or(
              lt(workspaceChatConversations.lastActivityAt, cursorDate),
              and(
                eq(workspaceChatConversations.lastActivityAt, cursorDate),
                lt(workspaceChatConversations.id, decodedCursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(
      desc(workspaceChatConversations.lastActivityAt),
      desc(workspaceChatConversations.id),
    )
    .limit(pageSize + 1)

  const pageRows = rows.slice(0, pageSize)
  const nextRow = rows.length > pageSize ? pageRows.at(-1) ?? null : null

  return {
    conversations: pageRows.map(mapWorkspaceChatConversationSummary),
    nextCursor: nextRow
      ? encodeWorkspaceChatConversationCursor({
          id: nextRow.id,
          lastActivityAt: nextRow.lastActivityAt.toISOString(),
        })
      : null,
  }
}

export async function createWorkspaceChatConversation(input: {
  kind: "ad_hoc" | "durable_named"
  orgSlug: string
  slug?: string
  title: string
  userExternalId: string
  visibility: "open" | "personal"
}): Promise<{
  createdConversation: WorkspaceChatConversationSummary
}> {
  if (input.kind === "durable_named" && !input.slug?.trim()) {
    throw new Error("Durable named conversations require a slug.")
  }

  if (input.kind === "ad_hoc" && input.slug?.trim()) {
    throw new Error("Ad hoc conversations cannot define a slug.")
  }

  const actor = await resolveWorkspaceChatActor({
    includeTenant: true,
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })
  const tenantId = actor.tenantId
  const db = getDb()

  if (!tenantId) {
    throw new Error("Workspace tenant runtime is not ready yet.")
  }

  if (input.slug?.trim()) {
    const [existingConversation] = await db
      .select({
        id: workspaceChatConversations.id,
      })
      .from(workspaceChatConversations)
      .where(
        and(
          eq(workspaceChatConversations.organizationId, actor.organizationId),
          eq(workspaceChatConversations.slug, input.slug.trim()),
        ),
      )
      .limit(1)

    if (existingConversation) {
      throw new Error("A conversation with this slug already exists.")
    }
  }

  const [conversation] = await db
    .insert(workspaceChatConversations)
    .values({
      createdByUserId: actor.userId,
      kind: input.kind,
      organizationId: actor.organizationId,
      slug: input.slug?.trim() || null,
      tenantId,
      title: input.title.trim(),
      visibility: input.visibility,
    })
    .returning({
      id: workspaceChatConversations.id,
      kind: workspaceChatConversations.kind,
      lastActivityAt: workspaceChatConversations.lastActivityAt,
      latestMessagePreview: workspaceChatConversations.latestMessagePreview,
      slug: workspaceChatConversations.slug,
      tenantId: workspaceChatConversations.tenantId,
      title: workspaceChatConversations.title,
      visibility: workspaceChatConversations.visibility,
    })

  if (!conversation) {
    throw new Error("Failed to create workspace chat conversation.")
  }

  return {
    createdConversation: mapWorkspaceChatConversationSummary(conversation),
  }
}

export async function getWorkspaceChatConversationDetail(input: {
  conversationId: string
  orgSlug: string
  userExternalId: string
}): Promise<WorkspaceChatConversationDetailResponse | null> {
  const actor = await resolveWorkspaceChatActor({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })
  const db = getDb()
  const conversation = await getAccessibleWorkspaceChatConversation({
    conversationId: input.conversationId,
    organizationId: actor.organizationId,
    userId: actor.userId,
  })

  if (!conversation) {
    return null
  }

  const messageRows = await db
    .select({
      authorExternalId: users.externalId,
      authorKind: workspaceChatMessages.authorKind,
      authorName: workspaceChatMessages.authorName,
      completedAt: workspaceChatMessages.completedAt,
      createdAt: workspaceChatMessages.createdAt,
      id: workspaceChatMessages.id,
      status: workspaceChatMessages.status,
    })
    .from(workspaceChatMessages)
    .leftJoin(users, eq(workspaceChatMessages.authorUserId, users.id))
    .where(eq(workspaceChatMessages.conversationId, conversation.id))
    .orderBy(workspaceChatMessages.createdAt)

  const messageIds = messageRows.map((message) => message.id)
  const partRows =
    messageIds.length === 0
      ? []
      : await db
          .select({
            attachmentId: workspaceChatMessageParts.attachmentId,
            durationMs: workspaceChatMessageParts.durationMs,
            fileName: workspaceChatMessageParts.fileName,
            id: workspaceChatMessageParts.id,
            messageId: workspaceChatMessageParts.messageId,
            mimeType: workspaceChatMessageParts.mimeType,
            ordinal: workspaceChatMessageParts.ordinal,
            partKind: workspaceChatMessageParts.partKind,
            textValue: workspaceChatMessageParts.textValue,
          })
          .from(workspaceChatMessageParts)
          .where(inArray(workspaceChatMessageParts.messageId, messageIds))
          .orderBy(
            workspaceChatMessageParts.messageId,
            workspaceChatMessageParts.ordinal,
          )
  const eventRows =
    messageIds.length === 0
      ? []
      : await db
          .select({
            conversationId: workspaceChatMessageEvents.conversationId,
            createdAt: workspaceChatMessageEvents.createdAt,
            eventType: workspaceChatMessageEvents.eventType,
            id: workspaceChatMessageEvents.id,
            itemId: workspaceChatMessageEvents.itemId,
            messageId: workspaceChatMessageEvents.messageId,
            payloadJson: workspaceChatMessageEvents.payloadJson,
            runId: workspaceChatMessageEvents.runId,
            runtimeSegmentId: workspaceChatMessageEvents.runtimeSegmentId,
            sequence: workspaceChatMessageEvents.sequence,
            sessionKey: workspaceChatMessageEvents.sessionKey,
            status: workspaceChatMessageEvents.status,
            summary: workspaceChatMessageEvents.summary,
            title: workspaceChatMessageEvents.title,
          })
          .from(workspaceChatMessageEvents)
          .where(inArray(workspaceChatMessageEvents.messageId, messageIds))
          .orderBy(
            workspaceChatMessageEvents.messageId,
            workspaceChatMessageEvents.sequence,
          )

  const partsByMessageId = new Map<string, WorkspaceChatMessagePart[]>()

  for (const partRow of partRows) {
    const parts = partsByMessageId.get(partRow.messageId) ?? []
    parts.push(
      mapWorkspaceChatMessagePartRecord({
        attachmentId: partRow.attachmentId,
        durationMs: partRow.durationMs,
        fileName: partRow.fileName,
        mimeType: partRow.mimeType,
        partKind: partRow.partKind,
        textValue: partRow.textValue,
      }),
    )
    partsByMessageId.set(partRow.messageId, parts)
  }

  const mappedEvents = eventRows.map(mapWorkspaceChatMessageEventRecord)
  const sessionKeys = [...new Set(
    mappedEvents
      .map((event) => event.sessionKey)
      .filter((sessionKey): sessionKey is string => Boolean(sessionKey)),
  )]
  const sessionRows =
    sessionKeys.length === 0
      ? []
      : await db
          .select({
            sessionKey: tenantSessions.sessionKey,
            transcriptJsonl: tenantSessions.transcriptJsonl,
          })
          .from(tenantSessions)
          .where(
            and(
              eq(tenantSessions.tenantId, conversation.tenantId),
              inArray(tenantSessions.sessionKey, sessionKeys),
            ),
          )
          .orderBy(desc(tenantSessions.updatedAt))
  const transcriptJsonlBySessionKey = new Map<string, string | null>()

  for (const sessionRow of sessionRows) {
    if (!transcriptJsonlBySessionKey.has(sessionRow.sessionKey)) {
      transcriptJsonlBySessionKey.set(
        sessionRow.sessionKey,
        sessionRow.transcriptJsonl,
      )
    }
  }

  return {
    conversation: mapWorkspaceChatConversationSummary(conversation),
    messageEvents: enrichWorkspaceChatMessageEventsWithTranscripts({
      events: mappedEvents,
      transcriptJsonlBySessionKey,
    }),
    messages: messageRows.map((message) =>
      mapWorkspaceChatMessage({
        message,
        parts: partsByMessageId.get(message.id) ?? [],
      }),
    ),
  }
}

export async function canAccessWorkspaceChatConversation(input: {
  conversationId: string
  orgSlug: string
  userExternalId: string
}): Promise<boolean> {
  const actor = await resolveWorkspaceChatActor({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })
  const conversation = await getAccessibleWorkspaceChatConversation({
    conversationId: input.conversationId,
    organizationId: actor.organizationId,
    userId: actor.userId,
  })

  return Boolean(conversation)
}

export async function createWorkspaceChatMessage(input: {
  clientMessageId?: string
  conversationId: string
  orgSlug: string
  parts: WorkspaceChatMessagePart[]
  userDisplayName: string
  userExternalId: string
}): Promise<WorkspaceChatMessageCreateResponse> {
  const result = await createWorkspaceChatMessageRecord(input)

  return {
    conversationId: result.conversationId,
    dispatch: result.dispatch,
    message: result.message,
  }
}

export async function createWorkspaceChatMessageRecord(input: {
  clientMessageId?: string
  conversationId: string
  orgSlug: string
  parts: WorkspaceChatMessagePart[]
  userDisplayName: string
  userExternalId: string
}): Promise<
  WorkspaceChatMessageCreateResponse & {
    assistantMessageId?: string
    conversationKind: "ad_hoc" | "durable_named" | "external_surface"
    conversationTitle: string
    conversationVisibility: "open" | "personal"
    shouldDispatch: boolean
    tenantId: string
  }
> {
  const actor = await resolveWorkspaceChatActor({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })
  const conversation = await getAccessibleWorkspaceChatConversation({
    conversationId: input.conversationId,
    organizationId: actor.organizationId,
    userId: actor.userId,
  })

  if (!conversation) {
    throw new Error("Conversation not found.")
  }

  const db = getDb()
  const normalizedClientMessageId = input.clientMessageId?.trim() || undefined
  const assistantClientMessageId = buildAssistantClientMessageId(
    normalizedClientMessageId,
  )
  const existingMessage = normalizedClientMessageId
    ? await getExistingWorkspaceChatMessageByClientId({
        clientMessageId: normalizedClientMessageId,
        conversationId: conversation.id,
      })
    : null

  if (existingMessage) {
    const existingAssistantMessage = assistantClientMessageId
      ? await getExistingWorkspaceChatMessageByClientId({
          clientMessageId: assistantClientMessageId,
          conversationId: conversation.id,
        })
      : null

    if (existingAssistantMessage) {
      return {
        assistantMessageId: existingAssistantMessage.id,
        conversationKind: normalizeWorkspaceChatConversationKind(
          conversation.kind,
        ),
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        conversationVisibility: normalizeWorkspaceChatConversationVisibility(
          conversation.visibility,
        ),
        dispatch: {
          status: mapDispatchStatusFromAssistantStatus(
            existingAssistantMessage.status,
          ),
        },
        message: existingMessage,
        shouldDispatch: false,
        tenantId: conversation.tenantId,
      }
    }

    const assistantMessageId = assistantClientMessageId
      ? await db.transaction(async (tx) => {
          const assistantCreatedAt = new Date()
          const [assistantMessage] = await tx
            .insert(workspaceChatMessages)
            .values({
              authorKind: "assistant",
              authorName: "Otto",
              clientMessageId: assistantClientMessageId,
              conversationId: conversation.id,
              createdAt: assistantCreatedAt,
              status: "pending",
              updatedAt: assistantCreatedAt,
            })
            .returning({
              id: workspaceChatMessages.id,
            })

          if (!assistantMessage) {
            throw new Error(
              "Failed to create workspace chat assistant placeholder.",
            )
          }

          return assistantMessage.id
        })
      : undefined

    if (assistantMessageId) {
      const assistantMessage =
        await getWorkspaceChatMessageById(assistantMessageId)

      if (assistantMessage) {
        await publishWorkspaceChatRealtimeEvent({
          conversationId: conversation.id,
          message: assistantMessage,
          type: "conversation.message_upserted",
        })
      }
    }

    return {
      assistantMessageId,
      conversationKind: normalizeWorkspaceChatConversationKind(
        conversation.kind,
      ),
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      conversationVisibility: normalizeWorkspaceChatConversationVisibility(
        conversation.visibility,
      ),
      dispatch: {
        status: "queued",
      },
      message: existingMessage,
      shouldDispatch: true,
      tenantId: conversation.tenantId,
    }
  }

  const createdMessage = await db.transaction(async (tx) => {
    const userCreatedAt = new Date()
    const [message] = await tx
      .insert(workspaceChatMessages)
      .values({
        authorKind: "user",
        authorName: input.userDisplayName,
        authorUserId: actor.userId,
        clientMessageId: normalizedClientMessageId ?? null,
        completedAt: userCreatedAt,
        conversationId: conversation.id,
        createdAt: userCreatedAt,
        status: "completed",
        updatedAt: userCreatedAt,
      })
      .returning({
        authorKind: workspaceChatMessages.authorKind,
        authorName: workspaceChatMessages.authorName,
        createdAt: workspaceChatMessages.createdAt,
        id: workspaceChatMessages.id,
        status: workspaceChatMessages.status,
      })

    if (!message) {
      throw new Error("Failed to create workspace chat message.")
    }

    const assistantCreatedAt = new Date(userCreatedAt.getTime() + 1)
    const [assistantMessage] = await tx
      .insert(workspaceChatMessages)
      .values({
        authorKind: "assistant",
        authorName: "Otto",
        clientMessageId: assistantClientMessageId ?? null,
        conversationId: conversation.id,
        createdAt: assistantCreatedAt,
        status: "pending",
        updatedAt: assistantCreatedAt,
      })
      .returning({
        id: workspaceChatMessages.id,
      })

    if (!assistantMessage) {
      throw new Error("Failed to create workspace chat assistant placeholder.")
    }

    await insertWorkspaceChatParts({
      messageId: message.id,
      parts: input.parts,
      tx,
    })

    await tx
      .update(workspaceChatConversations)
      .set({
        lastActivityAt: new Date(),
        latestMessagePreview: buildWorkspaceChatMessagePreview(input.parts),
        title: shouldAutoGenerateWorkspaceConversationTitle(conversation.title)
          ? generateWorkspaceConversationTitle(input.parts)
          : conversation.title,
        updatedAt: new Date(),
      })
      .where(eq(workspaceChatConversations.id, conversation.id))

    return {
      assistantMessageId: assistantMessage.id,
      message: mapWorkspaceChatMessage({
        message: {
          ...message,
          authorExternalId: actor.userExternalId,
          completedAt: userCreatedAt,
        },
        parts: input.parts,
      }),
    }
  })

  const [assistantMessage, conversationSummary] = await Promise.all([
    getWorkspaceChatMessageById(createdMessage.assistantMessageId),
    getWorkspaceChatConversationSummaryById(conversation.id),
  ])

  await publishWorkspaceChatRealtimeEvent({
    conversationId: conversation.id,
    message: createdMessage.message,
    type: "conversation.message_upserted",
  })

  if (assistantMessage) {
    await publishWorkspaceChatRealtimeEvent({
      conversationId: conversation.id,
      message: assistantMessage,
      type: "conversation.message_upserted",
    })
  }

  if (conversationSummary) {
    await publishWorkspaceChatRealtimeEvent({
      conversation: conversationSummary,
      type: "conversation.summary_updated",
    })
  }

  return {
    conversationKind: normalizeWorkspaceChatConversationKind(conversation.kind),
    conversationId: conversation.id,
    conversationTitle: conversation.title,
    conversationVisibility: normalizeWorkspaceChatConversationVisibility(
      conversation.visibility,
    ),
    dispatch: {
      status: "queued",
    },
    message: createdMessage.message,
    assistantMessageId: createdMessage.assistantMessageId,
    shouldDispatch: true,
    tenantId: conversation.tenantId,
  }
}

export async function completeWorkspaceChatAssistantMessage(input: {
  assistantMessageId?: string
  assistantDisplayName?: string
  conversationId: string
  parts: WorkspaceChatMessagePart[]
  session: {
    endedAt?: string
    externalSessionId?: string
    sessionKey: string
    startedAt?: string
    status: "active" | "completed" | "failed"
  }
  tenantId: string
}): Promise<{
  conversationId: string
  messageId: string
  runtimeSegmentId: string
  tenantId: string
} | null> {
  const db = getDb()
  const result = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .select({
        id: workspaceChatConversations.id,
        tenantId: workspaceChatConversations.tenantId,
      })
      .from(workspaceChatConversations)
      .where(
        and(
          eq(workspaceChatConversations.id, input.conversationId),
          eq(workspaceChatConversations.tenantId, input.tenantId),
        ),
      )
      .limit(1)

    if (!conversation) {
      return null
    }

    const [tenantSession] = input.session.externalSessionId?.trim()
      ? await tx
          .select({
            id: tenantSessions.id,
          })
          .from(tenantSessions)
          .where(
            and(
              eq(tenantSessions.tenantId, input.tenantId),
              eq(tenantSessions.sessionKey, input.session.sessionKey),
              eq(
                tenantSessions.externalSessionId,
                input.session.externalSessionId.trim(),
              ),
            ),
          )
          .limit(1)
      : []

    const [runtimeSegment] = await tx
      .insert(workspaceChatRuntimeSegments)
      .values({
        conversationId: conversation.id,
        endedAt: input.session.endedAt ? new Date(input.session.endedAt) : null,
        externalSessionId: input.session.externalSessionId?.trim() || null,
        sessionKey: input.session.sessionKey,
        startedAt: input.session.startedAt
          ? new Date(input.session.startedAt)
          : null,
        status: input.session.status,
        tenantId: input.tenantId,
        tenantSessionId: tenantSession?.id ?? null,
      })
      .onConflictDoUpdate({
        set: {
          endedAt: input.session.endedAt
            ? new Date(input.session.endedAt)
            : undefined,
          externalSessionId:
            input.session.externalSessionId?.trim() || undefined,
          startedAt: input.session.startedAt
            ? new Date(input.session.startedAt)
            : undefined,
          status: input.session.status,
          tenantSessionId: tenantSession?.id ?? undefined,
          updatedAt: new Date(),
        },
        target: [
          workspaceChatRuntimeSegments.conversationId,
          workspaceChatRuntimeSegments.sessionKey,
        ],
      })
      .returning({
        id: workspaceChatRuntimeSegments.id,
      })

    if (!runtimeSegment) {
      throw new Error("Failed to persist workspace chat runtime segment.")
    }

    const assistantCompletedAt = new Date()
    const assistantMessageId = input.assistantMessageId?.trim() || null
    const [updatedMessage] = assistantMessageId
      ? await tx
          .update(workspaceChatMessages)
          .set({
            authorKind: "assistant",
            authorName: input.assistantDisplayName?.trim() || "Otto",
            completedAt: assistantCompletedAt,
            status: "completed",
            updatedAt: assistantCompletedAt,
          })
          .where(
            and(
              eq(workspaceChatMessages.id, assistantMessageId),
              eq(workspaceChatMessages.conversationId, conversation.id),
            ),
          )
          .returning({
            id: workspaceChatMessages.id,
          })
      : []

    const [message] = updatedMessage
      ? [updatedMessage]
      : await tx
          .insert(workspaceChatMessages)
          .values({
            authorKind: "assistant",
            authorName: input.assistantDisplayName?.trim() || "Otto",
            completedAt: assistantCompletedAt,
            conversationId: conversation.id,
            status: "completed",
            updatedAt: assistantCompletedAt,
          })
          .returning({
            id: workspaceChatMessages.id,
          })

    if (!message) {
      throw new Error("Failed to persist workspace chat assistant message.")
    }

    await tx
      .delete(workspaceChatMessageParts)
      .where(eq(workspaceChatMessageParts.messageId, message.id))

    await insertWorkspaceChatParts({
      messageId: message.id,
      parts: input.parts,
      tx,
    })

    await tx
      .update(workspaceChatConversations)
      .set({
        lastActivityAt: new Date(),
        latestMessagePreview: buildWorkspaceChatMessagePreview(input.parts),
        updatedAt: new Date(),
      })
      .where(eq(workspaceChatConversations.id, conversation.id))

    return {
      conversationId: conversation.id,
      messageId: message.id,
      runtimeSegmentId: runtimeSegment.id,
      tenantId: input.tenantId,
    }
  })

  if (!result) {
    return null
  }

  const [message, conversationSummary] = await Promise.all([
    getWorkspaceChatMessageById(result.messageId),
    getWorkspaceChatConversationSummaryById(result.conversationId),
  ])

  if (message) {
    await publishWorkspaceChatRealtimeEvent({
      conversationId: result.conversationId,
      message,
      type: "conversation.message_upserted",
    })
  }

  if (conversationSummary) {
    await publishWorkspaceChatRealtimeEvent({
      conversation: conversationSummary,
      type: "conversation.summary_updated",
    })
  }

  return result
}

export async function applyWorkspaceChatAssistantDelta(input: {
  assistantDisplayName?: string
  assistantMessageId: string
  conversationId: string
  sequence: number
  tenantId: string
  text: string
}): Promise<{
  applied: boolean
  conversationId: string
  messageId: string
  tenantId: string
} | null> {
  const db = getDb()
  const result = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .select({
        id: workspaceChatConversations.id,
        tenantId: workspaceChatConversations.tenantId,
      })
      .from(workspaceChatConversations)
      .where(
        and(
          eq(workspaceChatConversations.id, input.conversationId),
          eq(workspaceChatConversations.tenantId, input.tenantId),
        ),
      )
      .limit(1)

    if (!conversation) {
      return null
    }

    const [assistantMessage] = await tx
      .select({
        id: workspaceChatMessages.id,
        lastStreamSequence: workspaceChatMessages.lastStreamSequence,
      })
      .from(workspaceChatMessages)
      .where(
        and(
          eq(workspaceChatMessages.id, input.assistantMessageId),
          eq(workspaceChatMessages.conversationId, conversation.id),
        ),
      )
      .limit(1)

    if (!assistantMessage) {
      return null
    }

    if (
      !shouldApplyWorkspaceChatAssistantDeltaSequence({
        incomingSequence: input.sequence,
        lastAppliedSequence: assistantMessage.lastStreamSequence,
      })
    ) {
      return {
        applied: false,
        conversationId: conversation.id,
        messageId: assistantMessage.id,
        tenantId: input.tenantId,
      }
    }

    const updatedAt = new Date()
    const deltaParts = buildWorkspaceChatAssistantDeltaParts(input.text)
    const [updatedMessage] = await tx
      .update(workspaceChatMessages)
      .set({
        authorKind: "assistant",
        authorName: input.assistantDisplayName?.trim() || "Otto",
        lastStreamSequence: input.sequence,
        status: "streaming",
        updatedAt,
      })
      .where(
        and(
          eq(workspaceChatMessages.id, input.assistantMessageId),
          eq(workspaceChatMessages.conversationId, conversation.id),
          inArray(workspaceChatMessages.status, ["pending", "streaming"]),
        ),
      )
      .returning({
        id: workspaceChatMessages.id,
      })

    if (!updatedMessage) {
      return {
        applied: false,
        conversationId: conversation.id,
        messageId: assistantMessage.id,
        tenantId: input.tenantId,
      }
    }

    await tx
      .delete(workspaceChatMessageParts)
      .where(eq(workspaceChatMessageParts.messageId, updatedMessage.id))

    await insertWorkspaceChatParts({
      messageId: updatedMessage.id,
      parts: deltaParts,
      tx,
    })

    await tx
      .update(workspaceChatConversations)
      .set({
        lastActivityAt: updatedAt,
        latestMessagePreview: buildWorkspaceChatMessagePreview(deltaParts),
        updatedAt,
      })
      .where(eq(workspaceChatConversations.id, conversation.id))

    return {
      applied: true,
      conversationId: conversation.id,
      messageId: updatedMessage.id,
      tenantId: input.tenantId,
    }
  })

  if (!result) {
    return null
  }

  if (!result.applied) {
    return result
  }

  const [message, conversationSummary] = await Promise.all([
    getWorkspaceChatMessageById(result.messageId),
    getWorkspaceChatConversationSummaryById(result.conversationId),
  ])

  if (message) {
    await publishWorkspaceChatRealtimeEvent({
      conversationId: result.conversationId,
      message,
      type: "conversation.message_upserted",
    })
  }

  if (conversationSummary) {
    await publishWorkspaceChatRealtimeEvent({
      conversation: conversationSummary,
      type: "conversation.summary_updated",
    })
  }

  return result
}

export async function upsertWorkspaceChatAssistantEvent(input: {
  assistantMessageId: string
  conversationId: string
  event: WorkspaceChatRuntimeMessageEventMutation
  tenantId: string
}): Promise<{
  conversationId: string
  eventId: string
  messageId: string
  tenantId: string
} | null> {
  const db = getDb()
  const result = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .select({
        id: workspaceChatConversations.id,
      })
      .from(workspaceChatConversations)
      .where(
        and(
          eq(workspaceChatConversations.id, input.conversationId),
          eq(workspaceChatConversations.tenantId, input.tenantId),
        ),
      )
      .limit(1)

    if (!conversation) {
      return null
    }

    const [assistantMessage] = await tx
      .select({
        id: workspaceChatMessages.id,
      })
      .from(workspaceChatMessages)
      .where(
        and(
          eq(workspaceChatMessages.id, input.assistantMessageId),
          eq(workspaceChatMessages.conversationId, conversation.id),
          eq(workspaceChatMessages.authorKind, "assistant"),
        ),
      )
      .limit(1)

    if (!assistantMessage) {
      return null
    }

    const [runtimeSegment] = input.event.sessionKey
      ? await tx
          .select({
            id: workspaceChatRuntimeSegments.id,
          })
          .from(workspaceChatRuntimeSegments)
          .where(
            and(
              eq(workspaceChatRuntimeSegments.conversationId, conversation.id),
              eq(
                workspaceChatRuntimeSegments.sessionKey,
                input.event.sessionKey,
              ),
            ),
          )
          .limit(1)
      : []

    const now = new Date()
    const [messageEvent] = await tx
      .insert(workspaceChatMessageEvents)
      .values({
        conversationId: conversation.id,
        createdAt: now,
        eventType: input.event.type,
        itemId: input.event.itemId ?? null,
        messageId: assistantMessage.id,
        payloadJson: input.event.payload,
        runId: input.event.runId ?? null,
        runtimeSegmentId:
          input.event.runtimeSegmentId ?? runtimeSegment?.id ?? null,
        sequence: input.event.sequence,
        sessionKey: input.event.sessionKey ?? null,
        status: input.event.status ?? null,
        summary: input.event.summary ?? null,
        tenantId: input.tenantId,
        title: input.event.title ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        set: {
          eventType: input.event.type,
          itemId: input.event.itemId ?? null,
          payloadJson: input.event.payload,
          runId: input.event.runId ?? null,
          runtimeSegmentId:
            input.event.runtimeSegmentId ?? runtimeSegment?.id ?? null,
          sessionKey: input.event.sessionKey ?? null,
          status: input.event.status ?? null,
          summary: input.event.summary ?? null,
          title: input.event.title ?? null,
          updatedAt: now,
        },
        target: [
          workspaceChatMessageEvents.messageId,
          workspaceChatMessageEvents.sequence,
        ],
      })
      .returning({
        id: workspaceChatMessageEvents.id,
      })

    if (!messageEvent) {
      throw new Error("Failed to persist workspace chat message event.")
    }

    return {
      conversationId: conversation.id,
      eventId: messageEvent.id,
      messageId: assistantMessage.id,
      tenantId: input.tenantId,
    }
  })

  if (!result) {
    return null
  }

  const messageEvent = await getWorkspaceChatMessageEventById(result.eventId)

  if (messageEvent) {
    await publishWorkspaceChatRealtimeEvent({
      conversationId: result.conversationId,
      event: messageEvent,
      type: "conversation.message_event_upserted",
    })
  }

  return result
}

export async function markWorkspaceChatAssistantMessageStreaming(input: {
  assistantMessageId: string
  conversationId: string
}) {
  const db = getDb()
  const [updatedMessage] = await db
    .update(workspaceChatMessages)
    .set({
      status: "streaming",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceChatMessages.id, input.assistantMessageId),
        eq(workspaceChatMessages.conversationId, input.conversationId),
        inArray(workspaceChatMessages.status, ["pending", "streaming"]),
      ),
    )
    .returning({
      id: workspaceChatMessages.id,
    })

  if (!updatedMessage) {
    return
  }

  const message = await getWorkspaceChatMessageById(updatedMessage.id)

  if (message) {
    await publishWorkspaceChatRealtimeEvent({
      conversationId: input.conversationId,
      message,
      type: "conversation.message_upserted",
    })
  }
}

export async function markWorkspaceChatAssistantMessageFailed(input: {
  assistantMessageId: string
  conversationId: string
}) {
  const db = getDb()
  const failedAt = new Date()
  const [updatedMessage] = await db
    .update(workspaceChatMessages)
    .set({
      completedAt: failedAt,
      status: "failed",
      updatedAt: failedAt,
    })
    .where(
      and(
        eq(workspaceChatMessages.id, input.assistantMessageId),
        eq(workspaceChatMessages.conversationId, input.conversationId),
        inArray(workspaceChatMessages.status, ["pending", "streaming"]),
      ),
    )
    .returning({
      id: workspaceChatMessages.id,
    })

  if (!updatedMessage) {
    return
  }

  const message = await getWorkspaceChatMessageById(updatedMessage.id)

  if (message) {
    await publishWorkspaceChatRealtimeEvent({
      conversationId: input.conversationId,
      message,
      type: "conversation.message_upserted",
    })
  }
}

function buildWorkspaceChatConversationAccessPredicate(userId: string) {
  return or(
    eq(workspaceChatConversations.visibility, OPEN_VISIBILITY),
    and(
      eq(workspaceChatConversations.visibility, PERSONAL_VISIBILITY),
      eq(workspaceChatConversations.createdByUserId, userId),
    ),
  )
}

async function getAccessibleWorkspaceChatConversation(input: {
  conversationId: string
  organizationId: string
  userId: string
}): Promise<WorkspaceChatConversationRow | null> {
  const db = getDb()
  const [conversation] = await db
    .select({
      id: workspaceChatConversations.id,
      kind: workspaceChatConversations.kind,
      lastActivityAt: workspaceChatConversations.lastActivityAt,
      latestMessagePreview: workspaceChatConversations.latestMessagePreview,
      slug: workspaceChatConversations.slug,
      tenantId: workspaceChatConversations.tenantId,
      title: workspaceChatConversations.title,
      visibility: workspaceChatConversations.visibility,
    })
    .from(workspaceChatConversations)
    .where(
      and(
        eq(workspaceChatConversations.id, input.conversationId),
        eq(workspaceChatConversations.organizationId, input.organizationId),
        buildWorkspaceChatConversationAccessPredicate(input.userId),
      ),
    )
    .limit(1)

  return conversation ?? null
}

async function getExistingWorkspaceChatMessageByClientId(input: {
  clientMessageId: string
  conversationId: string
}) {
  const db = getDb()
  const [message] = await db
    .select({
      authorExternalId: users.externalId,
      authorKind: workspaceChatMessages.authorKind,
      authorName: workspaceChatMessages.authorName,
      completedAt: workspaceChatMessages.completedAt,
      createdAt: workspaceChatMessages.createdAt,
      id: workspaceChatMessages.id,
      status: workspaceChatMessages.status,
    })
    .from(workspaceChatMessages)
    .leftJoin(users, eq(workspaceChatMessages.authorUserId, users.id))
    .where(
      and(
        eq(workspaceChatMessages.conversationId, input.conversationId),
        eq(workspaceChatMessages.clientMessageId, input.clientMessageId),
      ),
    )
    .limit(1)

  if (!message) {
    return null
  }

  const partRows = await db
    .select({
      attachmentId: workspaceChatMessageParts.attachmentId,
      durationMs: workspaceChatMessageParts.durationMs,
      fileName: workspaceChatMessageParts.fileName,
      mimeType: workspaceChatMessageParts.mimeType,
      partKind: workspaceChatMessageParts.partKind,
      textValue: workspaceChatMessageParts.textValue,
    })
    .from(workspaceChatMessageParts)
    .where(eq(workspaceChatMessageParts.messageId, message.id))
    .orderBy(workspaceChatMessageParts.ordinal)

  return mapWorkspaceChatMessage({
    message,
    parts: partRows.map(mapWorkspaceChatMessagePartRecord),
  })
}

async function getWorkspaceChatMessageById(messageId: string) {
  const db = getDb()
  const [message] = await db
    .select({
      authorExternalId: users.externalId,
      authorKind: workspaceChatMessages.authorKind,
      authorName: workspaceChatMessages.authorName,
      completedAt: workspaceChatMessages.completedAt,
      createdAt: workspaceChatMessages.createdAt,
      id: workspaceChatMessages.id,
      status: workspaceChatMessages.status,
    })
    .from(workspaceChatMessages)
    .leftJoin(users, eq(workspaceChatMessages.authorUserId, users.id))
    .where(eq(workspaceChatMessages.id, messageId))
    .limit(1)

  if (!message) {
    return null
  }

  const partRows = await db
    .select({
      attachmentId: workspaceChatMessageParts.attachmentId,
      durationMs: workspaceChatMessageParts.durationMs,
      fileName: workspaceChatMessageParts.fileName,
      mimeType: workspaceChatMessageParts.mimeType,
      partKind: workspaceChatMessageParts.partKind,
      textValue: workspaceChatMessageParts.textValue,
    })
    .from(workspaceChatMessageParts)
    .where(eq(workspaceChatMessageParts.messageId, message.id))
    .orderBy(workspaceChatMessageParts.ordinal)

  return mapWorkspaceChatMessage({
    message,
    parts: partRows.map(mapWorkspaceChatMessagePartRecord),
  })
}

async function getWorkspaceChatMessageEventById(eventId: string) {
  const db = getDb()
  const [messageEvent] = await db
    .select({
      conversationId: workspaceChatMessageEvents.conversationId,
      createdAt: workspaceChatMessageEvents.createdAt,
      eventType: workspaceChatMessageEvents.eventType,
      id: workspaceChatMessageEvents.id,
      itemId: workspaceChatMessageEvents.itemId,
      messageId: workspaceChatMessageEvents.messageId,
      payloadJson: workspaceChatMessageEvents.payloadJson,
      runId: workspaceChatMessageEvents.runId,
      runtimeSegmentId: workspaceChatMessageEvents.runtimeSegmentId,
      sequence: workspaceChatMessageEvents.sequence,
      sessionKey: workspaceChatMessageEvents.sessionKey,
      status: workspaceChatMessageEvents.status,
      summary: workspaceChatMessageEvents.summary,
      title: workspaceChatMessageEvents.title,
    })
    .from(workspaceChatMessageEvents)
    .where(eq(workspaceChatMessageEvents.id, eventId))
    .limit(1)

  return messageEvent ? mapWorkspaceChatMessageEventRecord(messageEvent) : null
}

async function getWorkspaceChatConversationSummaryById(conversationId: string) {
  const db = getDb()
  const [conversation] = await db
    .select({
      id: workspaceChatConversations.id,
      kind: workspaceChatConversations.kind,
      lastActivityAt: workspaceChatConversations.lastActivityAt,
      latestMessagePreview: workspaceChatConversations.latestMessagePreview,
      slug: workspaceChatConversations.slug,
      tenantId: workspaceChatConversations.tenantId,
      title: workspaceChatConversations.title,
      visibility: workspaceChatConversations.visibility,
    })
    .from(workspaceChatConversations)
    .where(eq(workspaceChatConversations.id, conversationId))
    .limit(1)

  return conversation ? mapWorkspaceChatConversationSummary(conversation) : null
}

async function publishWorkspaceChatRealtimeEvent(
  event: WorkspaceChatRealtimeEvent,
) {
  await getWorkspaceChatRealtimeHub().publish(event)
}

function buildAssistantClientMessageId(clientMessageId: string | undefined) {
  return clientMessageId ? `assistant:${clientMessageId}` : null
}

function buildWorkspaceChatAssistantDeltaParts(
  text: string,
): WorkspaceChatMessagePart[] {
  return text
    ? [
        {
          text,
          type: "text",
        },
      ]
    : []
}

async function insertWorkspaceChatParts(input: {
  messageId: string
  parts: WorkspaceChatMessagePart[]
  tx: Pick<ReturnType<typeof getDb>, "insert">
}) {
  if (input.parts.length === 0) {
    return
  }

  await input.tx.insert(workspaceChatMessageParts).values(
    input.parts.map((part, index) => ({
      attachmentId:
        part.type === "file" || part.type === "audio"
          ? part.attachmentId
          : null,
      durationMs: part.type === "audio" ? (part.durationMs ?? null) : null,
      fileName: part.type === "file" ? part.fileName : null,
      messageId: input.messageId,
      mimeType:
        part.type === "file" || part.type === "audio" ? part.mimeType : null,
      ordinal: index,
      partKind: part.type,
      textValue:
        part.type === "text"
          ? part.text
          : part.type === "audio"
            ? (part.transcript ?? null)
            : null,
    })),
  )
}

function mapWorkspaceChatConversationSummary(
  row: WorkspaceChatConversationRow,
): WorkspaceChatConversationSummary {
  return {
    id: row.id,
    kind: normalizeWorkspaceChatConversationKind(row.kind),
    lastActivityAt: row.lastActivityAt.toISOString(),
    latestMessagePreview: row.latestMessagePreview,
    originKind: deriveWorkspaceChatConversationOriginKind(row.kind),
    slug: row.slug ?? undefined,
    title: row.title,
    visibility: normalizeWorkspaceChatConversationVisibility(row.visibility),
  }
}

function mapWorkspaceChatMessage(input: {
  message: WorkspaceChatMessageRow
  parts: WorkspaceChatMessagePart[]
}): WorkspaceChatMessage {
  return {
    author: {
      kind: input.message.authorKind as WorkspaceChatMessage["author"]["kind"],
      name: input.message.authorName ?? undefined,
      userId: input.message.authorExternalId ?? undefined,
    },
    createdAt: input.message.createdAt.toISOString(),
    id: input.message.id,
    parts: input.parts,
    status: input.message.status as WorkspaceChatMessage["status"],
  }
}

function mapDispatchStatusFromAssistantStatus(
  status: WorkspaceChatMessage["status"],
): WorkspaceChatMessageCreateResponse["dispatch"]["status"] {
  if (status === "completed") {
    return "sent"
  }

  if (status === "pending" || status === "streaming") {
    return "queued"
  }

  return "failed"
}

function normalizeWorkspaceChatConversationKind(
  value: string,
): WorkspaceChatConversationSummary["kind"] {
  if (value === "durable_named" || value === "external_surface") {
    return value
  }

  return "ad_hoc"
}

function normalizeWorkspaceChatConversationVisibility(
  value: string,
): WorkspaceChatConversationSummary["visibility"] {
  return value === "personal" ? "personal" : "open"
}

export async function resolveWorkspaceChatActor(input: {
  includeTenant?: boolean
  orgSlug: string
  userExternalId: string
}): Promise<WorkspaceChatActor> {
  const workspace = await getOrganizationWorkspaceBySlug({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })
  const db = getDb()
  const [user] = await db
    .select({
      id: users.id,
      externalId: users.externalId,
    })
    .from(users)
    .where(eq(users.externalId, input.userExternalId))
    .limit(1)

  if (!user) {
    throw new Error("Workspace user not found.")
  }

  if (!input.includeTenant) {
    return {
      organizationId: workspace.id,
      tenantId: null,
      userExternalId: user.externalId,
      userId: user.id,
    }
  }

  const [tenant] = await db
    .select({
      id: tenants.id,
    })
    .from(tenants)
    .where(eq(tenants.organizationId, workspace.id))
    .orderBy(desc(tenants.createdAt))
    .limit(1)

  if (!tenant) {
    throw new Error("Workspace tenant runtime is not ready yet.")
  }

  return {
    organizationId: workspace.id,
    tenantId: tenant.id,
    userExternalId: user.externalId,
    userId: user.id,
  }
}

function truncatePreview(value: string, maxLength = 160) {
  const trimmed = value.trim()

  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 1)}…`
}
