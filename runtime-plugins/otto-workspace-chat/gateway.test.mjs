import assert from "node:assert/strict";
import test from "node:test";

import { dispatchWorkspaceChatInboundTurn } from "./inbound-dispatch.js";

function createRuntime() {
  const agentEventListeners = [];
  const finalizeCalls = [];
  const formatCalls = [];
  const routeCalls = [];
  const storePathCalls = [];
  const timestampCalls = [];

  const runtime = {
    events: {
      onAgentEvent(callback) {
        agentEventListeners.push(callback);
        return () => {
          const index = agentEventListeners.indexOf(callback);

          if (index >= 0) {
            agentEventListeners.splice(index, 1);
          }
        };
      },
    },
    channel: {
      routing: {
        resolveAgentRoute: (input) => {
          routeCalls.push(input);
          return {
            accountId: "default",
            agentId: "main",
            sessionKey: "agent:main:otto-workspace-chat:workspace:conv_1?assistantMessageId=msg_1",
          };
        },
      },
      session: {
        readSessionUpdatedAt: (input) => {
          timestampCalls.push(input);
          return "2026-04-12T10:00:00.000Z";
        },
        resolveStorePath: (store, input) => {
          storePathCalls.push({ input, store });
          return "/tmp/sessions.json";
        },
      },
      reply: {
        finalizeInboundContext: (input) => {
          finalizeCalls.push(input);
          return {
            ...input,
            Body: input.Body,
          };
        },
        formatAgentEnvelope: (input) => {
          formatCalls.push(input);
          return `[${input.channel}] ${input.from}: ${input.body}`;
        },
        resolveEnvelopeFormatOptions: () => ({
          includeReplyPrefix: true,
        }),
      },
    },
  };

  return {
    agentEventListeners,
    finalizeCalls,
    formatCalls,
    routeCalls,
    runtime,
    storePathCalls,
    timestampCalls,
  };
}

test("dispatchWorkspaceChatInboundTurn injects a synthetic inbound channel event and posts delta plus completion callbacks", async () => {
  const previousBaseUrl = process.env.OTTO_CONTROL_PLANE_BASE_URL;
  const previousTenantToken = process.env.TENANT_TOKEN;
  const previousFetch = globalThis.fetch;
  const fetchCalls = [];
  const {
    finalizeCalls,
    formatCalls,
    routeCalls,
    runtime,
    storePathCalls,
    timestampCalls,
  } = createRuntime();
  const dispatchCalls = [];

  process.env.OTTO_CONTROL_PLANE_BASE_URL = "https://workspace.example";
  process.env.TENANT_TOKEN = "tenant-token";
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({
      body: init?.body,
      method: init?.method,
      url,
    });

    return new Response(JSON.stringify({ ok: true, tenantId: "tenant_1" }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  };

  try {
    const result = await dispatchWorkspaceChatInboundTurn(
      {
        assistantMessageId: "msg_1",
        conversationKind: "ad_hoc",
        conversationId: "conv_1",
        conversationTitle: "Portfolio review",
        conversationVisibility: "open",
        message: "Summarize the latest notes.",
        senderDisplayName: "Michael Froehlich",
        senderExternalId: "user_1",
        userMessageId: "user_msg_1",
      },
      {
        cfg: {
          session: {
            store: {
              path: "/tmp/sessions.json",
            },
          },
        },
        dispatchInboundReplyWithBase: async (params) => {
          dispatchCalls.push(params);
          await params.replyOptions?.onPartialReply?.({ text: "Hel" });
          await params.replyOptions?.onPartialReply?.({ text: "Hello there" });
          await params.deliver({ text: "Hello there" });
        },
        runtime,
      },
    );

    assert.deepEqual(result, {
      ok: true,
      sessionKey: "agent:main:otto-workspace-chat:workspace:conv_1?assistantMessageId=msg_1",
    });
    assert.equal(routeCalls.length, 1);
    assert.deepEqual(routeCalls[0], {
      accountId: "default",
      cfg: {
        session: {
          store: {
            path: "/tmp/sessions.json",
          },
        },
      },
      channel: "otto-workspace-chat",
      peer: {
        id: "workspace:conv_1?assistantMessageId=msg_1",
        kind: "channel",
      },
    });
    assert.equal(storePathCalls.length, 1);
    assert.deepEqual(storePathCalls[0], {
      input: {
        agentId: "main",
      },
      store: {
        path: "/tmp/sessions.json",
      },
    });
    assert.equal(timestampCalls.length, 1);
    assert.equal(formatCalls.length, 1);
    assert.equal(finalizeCalls.length, 1);
    assert.equal(dispatchCalls.length, 1);
    assert.equal(dispatchCalls[0].route.sessionKey, result.sessionKey);
    assert.equal(
      dispatchCalls[0].ctxPayload.ConversationLabel,
      "Portfolio review",
    );
    assert.equal(dispatchCalls[0].ctxPayload.ChatType, "group");
    assert.equal(
      dispatchCalls[0].ctxPayload.OriginatingChannel,
      "otto-workspace-chat",
    );
    assert.equal(dispatchCalls[0].ctxPayload.Provider, "webchat");
    assert.equal(dispatchCalls[0].ctxPayload.SenderName, "Michael Froehlich");
    assert.equal(dispatchCalls[0].ctxPayload.SenderId, "user_1");
    assert.equal(dispatchCalls[0].ctxPayload.Surface, "webchat");
    assert.equal(dispatchCalls[0].ctxPayload.From, "workspace-user:user_1@conv_1");
    assert.equal(dispatchCalls[0].ctxPayload.MessageSid, "user_msg_1");

    assert.equal(fetchCalls.length, 3);
    assert.equal(
      fetchCalls[0].url,
      "https://workspace.example/api/internal/runtime/workspace-chat/messages/delta",
    );
    assert.equal(
      fetchCalls[2].url,
      "https://workspace.example/api/internal/runtime/workspace-chat/messages/complete",
    );
    assert.deepEqual(JSON.parse(fetchCalls[0].body), {
      assistantDisplayName: "Otto",
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      message: {
        text: "Hel",
      },
      sequence: 1,
    });
    assert.deepEqual(JSON.parse(fetchCalls[1].body), {
      assistantDisplayName: "Otto",
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      message: {
        text: "Hello there",
      },
      sequence: 2,
    });
    assert.deepEqual(JSON.parse(fetchCalls[2].body), {
      assistantDisplayName: "Otto",
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      message: {
        parts: [
          {
            text: "Hello there",
            type: "text",
          },
        ],
      },
      session: {
        sessionKey: "agent:main:otto-workspace-chat:workspace:conv_1?assistantMessageId=msg_1",
        status: "completed",
      },
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBaseUrl === undefined) {
      delete process.env.OTTO_CONTROL_PLANE_BASE_URL;
    } else {
      process.env.OTTO_CONTROL_PLANE_BASE_URL = previousBaseUrl;
    }
    if (previousTenantToken === undefined) {
      delete process.env.TENANT_TOKEN;
    } else {
      process.env.TENANT_TOKEN = previousTenantToken;
    }
  }
});

test("dispatchWorkspaceChatInboundTurn forwards normalized runtime activity events", async () => {
  const previousBaseUrl = process.env.OTTO_CONTROL_PLANE_BASE_URL;
  const previousTenantToken = process.env.TENANT_TOKEN;
  const previousFetch = globalThis.fetch;
  const fetchCalls = [];
  const { agentEventListeners, runtime } = createRuntime();

  process.env.OTTO_CONTROL_PLANE_BASE_URL = "https://workspace.example";
  process.env.TENANT_TOKEN = "tenant-token";
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({
      body: init?.body,
      method: init?.method,
      url,
    });

    return new Response(JSON.stringify({ ok: true, tenantId: "tenant_1" }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  };

  try {
    await dispatchWorkspaceChatInboundTurn(
      {
        assistantMessageId: "msg_1",
        conversationKind: "ad_hoc",
        conversationId: "conv_1",
        conversationTitle: "Portfolio review",
        conversationVisibility: "open",
        message: "Summarize the latest notes.",
        senderDisplayName: "Michael Froehlich",
        senderExternalId: "user_1",
        userMessageId: "user_msg_1",
      },
      {
        cfg: {
          session: {
            store: {
              path: "/tmp/sessions.json",
            },
          },
        },
        dispatchInboundReplyWithBase: async () => {
          const listener = agentEventListeners[0];
          listener?.({
            data: {
              phase: "start",
              toolCallId: "tool_1",
              name: "read_file",
            },
            runId: "run_1",
            seq: 1,
            sessionKey:
              "agent:main:otto-workspace-chat:workspace:conv_1?assistantMessageId=msg_1",
            stream: "tool",
            ts: Date.now(),
          });
        },
        runtime,
      },
    );

    const activityEventCall = fetchCalls.find((call) =>
      String(call.url).endsWith("/api/internal/runtime/workspace-chat/messages/events"),
    );

    assert.ok(activityEventCall);
    assert.deepEqual(JSON.parse(activityEventCall.body), {
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      event: {
        itemId: "tool_1",
        payload: {
          name: "read_file",
          phase: "start",
          toolCallId: "tool_1",
        },
        runId: "run_1",
        sequence: 1,
        sessionKey:
          "agent:main:otto-workspace-chat:workspace:conv_1?assistantMessageId=msg_1",
        status: "running",
        title: "read_file",
        type: "tool.started",
      },
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBaseUrl === undefined) {
      delete process.env.OTTO_CONTROL_PLANE_BASE_URL;
    } else {
      process.env.OTTO_CONTROL_PLANE_BASE_URL = previousBaseUrl;
    }
    if (previousTenantToken === undefined) {
      delete process.env.TENANT_TOKEN;
    } else {
      process.env.TENANT_TOKEN = previousTenantToken;
    }
  }
});

test("dispatchWorkspaceChatInboundTurn reports a failed assistant message when shared dispatch throws", async () => {
  const previousBaseUrl = process.env.OTTO_CONTROL_PLANE_BASE_URL;
  const previousTenantToken = process.env.TENANT_TOKEN;
  const previousFetch = globalThis.fetch;
  const fetchCalls = [];

  process.env.OTTO_CONTROL_PLANE_BASE_URL = "https://workspace.example";
  process.env.TENANT_TOKEN = "tenant-token";
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({
      body: init?.body,
      method: init?.method,
      url,
    });

    return new Response(JSON.stringify({ ok: true, tenantId: "tenant_1" }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  };

  try {
    await assert.rejects(
      () =>
        dispatchWorkspaceChatInboundTurn(
          {
            assistantMessageId: "msg_1",
            conversationKind: "ad_hoc",
            conversationId: "conv_1",
            conversationTitle: "Portfolio review",
            conversationVisibility: "open",
            message: "Summarize the latest notes.",
            senderDisplayName: "Michael Froehlich",
            senderExternalId: "user_1",
            userMessageId: "user_msg_1",
          },
          {
            cfg: {},
            dispatchInboundReplyWithBase: async () => {
              throw new Error("shared inbound dispatch failed");
            },
            runtime: createRuntime().runtime,
          },
        ),
      /shared inbound dispatch failed/,
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(
      fetchCalls[0].url,
      "https://workspace.example/api/internal/runtime/workspace-chat/messages/fail",
    );
    assert.deepEqual(JSON.parse(fetchCalls[0].body), {
      assistantDisplayName: "Otto",
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      error: "shared inbound dispatch failed",
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBaseUrl === undefined) {
      delete process.env.OTTO_CONTROL_PLANE_BASE_URL;
    } else {
      process.env.OTTO_CONTROL_PLANE_BASE_URL = previousBaseUrl;
    }
    if (previousTenantToken === undefined) {
      delete process.env.TENANT_TOKEN;
    } else {
      process.env.TENANT_TOKEN = previousTenantToken;
    }
  }
});

test("dispatchWorkspaceChatInboundTurn maps personal conversations to direct routing and preserves media references in the final completion", async () => {
  const previousBaseUrl = process.env.OTTO_CONTROL_PLANE_BASE_URL;
  const previousTenantToken = process.env.TENANT_TOKEN;
  const previousFetch = globalThis.fetch;
  const fetchCalls = [];
  const { routeCalls, runtime } = createRuntime();

  process.env.OTTO_CONTROL_PLANE_BASE_URL = "https://workspace.example";
  process.env.TENANT_TOKEN = "tenant-token";
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({
      body: init?.body,
      method: init?.method,
      url,
    });

    return new Response(JSON.stringify({ ok: true, tenantId: "tenant_1" }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  };

  try {
    await dispatchWorkspaceChatInboundTurn(
      {
        assistantMessageId: "msg_1",
        conversationKind: "ad_hoc",
        conversationId: "conv_1",
        conversationTitle: "Direct with Otto",
        conversationVisibility: "personal",
        message: "Show me the artifact",
        senderDisplayName: "Michael Froehlich",
        senderExternalId: "user_1",
        userMessageId: "user_msg_1",
      },
      {
        cfg: {},
        dispatchInboundReplyWithBase: async (params) => {
          await params.deliver({
            mediaUrl: "https://files.example/output.png",
            text: "Artifact ready",
          });
        },
        runtime,
      },
    );

    assert.deepEqual(routeCalls[0].peer, {
      id: "workspace:conv_1?assistantMessageId=msg_1&visibility=personal",
      kind: "direct",
    });
    assert.deepEqual(JSON.parse(fetchCalls.at(-1).body), {
      assistantDisplayName: "Otto",
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      message: {
        parts: [
          {
            text: "Artifact ready",
            type: "text",
          },
          {
            text: "[Media] https://files.example/output.png",
            type: "text",
          },
        ],
      },
      session: {
        sessionKey: "agent:main:otto-workspace-chat:workspace:conv_1?assistantMessageId=msg_1",
        status: "completed",
      },
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBaseUrl === undefined) {
      delete process.env.OTTO_CONTROL_PLANE_BASE_URL;
    } else {
      process.env.OTTO_CONTROL_PLANE_BASE_URL = previousBaseUrl;
    }
    if (previousTenantToken === undefined) {
      delete process.env.TENANT_TOKEN;
    } else {
      process.env.TENANT_TOKEN = previousTenantToken;
    }
  }
});
