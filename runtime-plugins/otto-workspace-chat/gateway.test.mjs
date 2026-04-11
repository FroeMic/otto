import assert from "node:assert/strict";
import test from "node:test";

import { runWorkspaceChatTurn } from "./gateway.js";

function createRuntime() {
  const calls = [];
  const runtime = {
    agent: {
      defaults: {
        model: "gpt-5.4",
        provider: "openai",
      },
      ensureAgentWorkspace: async () => undefined,
      resolveAgentDir: () => "/tmp/agent",
      resolveAgentIdentity: () => ({ name: "Otto" }),
      resolveAgentTimeoutMs: () => 30_000,
      resolveAgentWorkspaceDir: () => "/tmp/workspace",
      resolveThinkingDefault: () => "off",
      runEmbeddedPiAgent: async (input) => {
        calls.push(input);
        await input.onPartialReply?.({ text: "Hel" });
        await input.onPartialReply?.({ text: "Hello there" });
        return {
          meta: {
            agentMeta: {
              sessionId: "external_session_1",
            },
          },
          payloads: [{ text: "Hello there" }],
        };
      },
      session: {
        resolveSessionFilePath: (_cfg, sessionId) => `/tmp/${sessionId}.jsonl`,
      },
    },
  };

  return { calls, runtime };
}

test("runWorkspaceChatTurn streams deltas and completes through the control-plane callbacks", async () => {
  const previousBaseUrl = process.env.OTTO_CONTROL_PLANE_BASE_URL;
  const previousTenantToken = process.env.TENANT_TOKEN;
  const previousFetch = globalThis.fetch;
  const fetchCalls = [];
  const { calls, runtime } = createRuntime();

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
    const result = await runWorkspaceChatTurn({
      assistantMessageId: "msg_1",
      cfg: {},
      conversationId: "conv_1",
      message: "Summarize the latest notes.",
      runtime,
    });

    assert.equal(result.sessionKey, "workspace:conv_1?assistantMessageId=msg_1");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].messageChannel, "otto-workspace-chat");
    assert.equal(calls[0].messageTo, "workspace:conv_1?assistantMessageId=msg_1");
    assert.equal(calls[0].prompt, "Summarize the latest notes.");

    assert.equal(fetchCalls.length, 4);
    assert.equal(
      fetchCalls[0].url,
      "https://workspace.example/api/internal/runtime/workspace-chat/messages/delta",
    );
    assert.equal(
      fetchCalls[3].url,
      "https://workspace.example/api/internal/runtime/workspace-chat/messages/complete",
    );
    assert.deepEqual(JSON.parse(fetchCalls[0].body), {
      assistantDisplayName: "Otto",
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      message: {
        text: "",
      },
      sequence: 1,
    });
    assert.deepEqual(JSON.parse(fetchCalls[3].body), {
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
        externalSessionId: "external_session_1",
        sessionKey: "workspace:conv_1?assistantMessageId=msg_1",
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

test("runWorkspaceChatTurn reports a failed assistant message when execution throws", async () => {
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
        runWorkspaceChatTurn({
          assistantMessageId: "msg_1",
          cfg: {},
          conversationId: "conv_1",
          message: "Summarize the latest notes.",
          runtime: {
            agent: {
              defaults: {
                model: "gpt-5.4",
                provider: "openai",
              },
              ensureAgentWorkspace: async () => undefined,
              resolveAgentDir: () => "/tmp/agent",
              resolveAgentIdentity: () => ({ name: "Otto" }),
              resolveAgentTimeoutMs: () => 30_000,
              resolveAgentWorkspaceDir: () => "/tmp/workspace",
              resolveThinkingDefault: () => "off",
              runEmbeddedPiAgent: async () => {
                throw new Error("embedded run failed");
              },
              session: {
                resolveSessionFilePath: (_cfg, sessionId) => `/tmp/${sessionId}.jsonl`,
              },
            },
          },
        }),
      /embedded run failed/,
    );

    assert.equal(fetchCalls.length, 2);
    assert.equal(
      fetchCalls[1].url,
      "https://workspace.example/api/internal/runtime/workspace-chat/messages/fail",
    );
    assert.deepEqual(JSON.parse(fetchCalls[1].body), {
      assistantDisplayName: "Otto",
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      error: "embedded run failed",
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
