import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import {
  handleWorkspaceChatHttpRequest,
  registerWorkspaceChatPluginHttpRoutes,
  WORKSPACE_CHAT_HTTP_INGRESS_PATH,
} from "./http-routes.js";

test("registerWorkspaceChatPluginHttpRoutes exposes a gateway-authenticated ingress route", async () => {
  const routes = [];

  registerWorkspaceChatPluginHttpRoutes(
    {
      config: { channels: {} },
      registerHttpRoute: (params) => {
        routes.push(params);
      },
      runtime: { channel: {} },
    },
    {
      dispatchInboundReplyWithBase: async () => undefined,
    },
  );

  assert.equal(routes.length, 1);
  assert.equal(routes[0].path, WORKSPACE_CHAT_HTTP_INGRESS_PATH);
  assert.equal(routes[0].auth, "gateway");
  assert.equal(typeof routes[0].handler, "function");
});

test("handleWorkspaceChatHttpRequest dispatches a posted workspace event", async () => {
  const previousBaseUrl = process.env.OTTO_CONTROL_PLANE_BASE_URL;
  const previousTenantToken = process.env.TENANT_TOKEN;
  const previousFetch = globalThis.fetch;
  const req = Readable.from([
    JSON.stringify({
      assistantMessageId: "msg_1",
      conversationId: "conv_1",
      conversationKind: "ad_hoc",
      conversationTitle: "Portfolio review",
      conversationVisibility: "open",
      message: "Hello there",
      senderDisplayName: "Michael Froehlich",
      senderExternalId: "user_1",
      userMessageId: "user_msg_1",
    }),
  ]);
  req.method = "POST";
  req.headers = {
    "content-type": "application/json",
  };

  process.env.OTTO_CONTROL_PLANE_BASE_URL = "https://workspace.example";
  process.env.TENANT_TOKEN = "tenant-token";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true, tenantId: "tenant_1" }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });

  try {
    const response = createResponseRecorder();
    const dispatchCalls = [];

    const handled = await handleWorkspaceChatHttpRequest(req, response, {
      cfg: {
        session: {
          store: {
            path: "/tmp/sessions.json",
          },
        },
      },
      dispatchInboundReplyWithBase: async (params) => {
        dispatchCalls.push(params);
        await params.replyOptions?.onPartialReply?.({ text: "Hello" });
        await params.deliver({ text: "Hello there" });
      },
      runtime: createRuntime(),
    });

    assert.equal(handled, true);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      ok: true,
      sessionKey: "agent:main:otto-workspace-chat:workspace:conv_1?assistantMessageId=msg_1",
    });
    assert.equal(dispatchCalls.length, 1);
    assert.equal(
      dispatchCalls[0].ctxPayload.SessionKey,
      "agent:main:otto-workspace-chat:workspace:conv_1?assistantMessageId=msg_1",
    );
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

test("handleWorkspaceChatHttpRequest rejects missing conversation ids", async () => {
  const req = Readable.from([
    JSON.stringify({
      message: "Hello there",
    }),
  ]);
  req.method = "POST";
  req.headers = {
    "content-type": "application/json",
  };

  const response = createResponseRecorder();

  const handled = await handleWorkspaceChatHttpRequest(req, response, {
    cfg: {},
    dispatchInboundReplyWithBase: async () => undefined,
    runtime: createRuntime(),
  });

  assert.equal(handled, true);
  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), {
    error: "conversationId required",
  });
});

function createRuntime() {
  return {
    channel: {
      routing: {
        resolveAgentRoute: () => ({
          accountId: "default",
          agentId: "main",
          sessionKey: "agent:main:otto-workspace-chat:workspace:conv_1?assistantMessageId=msg_1",
        }),
      },
      session: {
        readSessionUpdatedAt: () => "2026-04-12T10:00:00.000Z",
        resolveStorePath: () => "/tmp/sessions.json",
      },
      reply: {
        finalizeInboundContext: (input) => input,
        formatAgentEnvelope: (input) => `[${input.channel}] ${input.from}: ${input.body}`,
        resolveEnvelopeFormatOptions: () => ({
          includeReplyPrefix: true,
        }),
      },
    },
  };
}

function createResponseRecorder() {
  return {
    body: "",
    headers: {},
    headersSent: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(chunk) {
      this.headersSent = true;
      this.body = typeof chunk === "string" ? chunk : chunk?.toString("utf8") ?? "";
    },
    statusCode: 200,
  };
}
