import { NextResponse } from "next/server";

import {
  type TenantSessionUpsertInput,
  upsertTenantSessionBatch,
} from "../../../../../../db/control-plane";
import { authenticateTenantRuntimeRequest } from "../../../../../../lib/runtime-auth";

export const dynamic = "force-dynamic";

const MAX_SESSIONS_PER_REQUEST = 50;

export async function POST(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const body = await request.json();

    const sessions = validatePayload(body);

    await upsertTenantSessionBatch(tenantId, sessions);

    return json({
      ok: true,
      synced: sessions.length,
    });
  } catch (error) {
    return handleError(error);
  }
}

function validatePayload(body: unknown): TenantSessionUpsertInput[] {
  if (!body || typeof body !== "object" || !("sessions" in body)) {
    throw new ValidationError("Request body must contain a sessions array");
  }

  const { sessions } = body as { sessions: unknown };

  if (!Array.isArray(sessions)) {
    throw new ValidationError("sessions must be an array");
  }

  if (sessions.length === 0) {
    throw new ValidationError("sessions array must not be empty");
  }

  if (sessions.length > MAX_SESSIONS_PER_REQUEST) {
    throw new ValidationError(
      `sessions array must not exceed ${MAX_SESSIONS_PER_REQUEST} items`,
    );
  }

  return sessions.map((s, i) => {
    if (!s || typeof s !== "object") {
      throw new ValidationError(`sessions[${i}] must be an object`);
    }

    const session = s as Record<string, unknown>;

    if (typeof session.sessionKey !== "string" || !session.sessionKey.trim()) {
      throw new ValidationError(
        `sessions[${i}].sessionKey must be a non-empty string`,
      );
    }

    if (typeof session.status !== "string" || !session.status.trim()) {
      throw new ValidationError(
        `sessions[${i}].status must be a non-empty string`,
      );
    }

    return {
      sessionKey: session.sessionKey,
      externalSessionId: optString(session.externalSessionId),
      displayName: optString(session.displayName),
      label: optString(session.label),
      subject: optString(session.subject),
      channel: optString(session.channel),
      channelProvider: optString(session.channelProvider),
      chatType: optString(session.chatType),
      originFrom: optString(session.originFrom),
      originTo: optString(session.originTo),
      originAccountId: optString(session.originAccountId),
      originThreadId: optString(session.originThreadId),
      status: session.status as string,
      startedAt: optNumber(session.startedAt),
      endedAt: optNumber(session.endedAt),
      runtimeMs: optNumber(session.runtimeMs),
      model: optString(session.model),
      modelProvider: optString(session.modelProvider),
      inputTokens: optNumber(session.inputTokens),
      outputTokens: optNumber(session.outputTokens),
      cacheReadTokens: optNumber(session.cacheReadTokens),
      cacheWriteTokens: optNumber(session.cacheWriteTokens),
      totalTokens: optNumber(session.totalTokens),
      estimatedCostUsd: optString(session.estimatedCostUsd),
      transcriptJsonl: optString(session.transcriptJsonl),
      transcriptHash: optString(session.transcriptHash),
      messageCount: optNumber(session.messageCount),
      lastMessageAt: optNumber(session.lastMessageAt),
      parentSessionKey: optString(session.parentSessionKey),
      spawnDepth: optNumber(session.spawnDepth),
      subagentRole: optString(session.subagentRole),
      sessionUpdatedAt: optNumber(session.sessionUpdatedAt),
      syncSource: "callback",
    } satisfies TenantSessionUpsertInput;
  });
}

function optString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function optNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function handleError(error: unknown) {
  if (
    error instanceof Error &&
    (error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token")
  ) {
    return json({ code: "unauthorized", message: error.message }, 401);
  }

  if (error instanceof ValidationError) {
    return json({ code: "validation_error", message: error.message }, 400);
  }

  if (error instanceof Error) {
    console.error("[sessions/sync] Unexpected error:", error.message);
    return json({ code: "session_sync_failed", message: error.message }, 500);
  }

  return json(
    { code: "session_sync_failed", message: "Session sync failed" },
    500,
  );
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
