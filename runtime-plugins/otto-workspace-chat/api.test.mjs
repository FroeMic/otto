import assert from "node:assert/strict";
import test from "node:test";

import {
  hasConfiguredWorkspaceChatRuntime,
  resolveWorkspaceChatAccount,
} from "./channel-config.js";
import { sendWorkspaceChatText } from "./outbound.js";

test("otto-workspace-chat resolves as configured for managed runtimes", async () => {
  const previousBaseUrl = process.env.OTTO_CONTROL_PLANE_BASE_URL;
  const previousTenantToken = process.env.TENANT_TOKEN;

  process.env.OTTO_CONTROL_PLANE_BASE_URL = "https://workspace.example";
  process.env.TENANT_TOKEN = "tenant-token";

  try {
    const cfg = {
      channels: {
        "otto-workspace-chat": {
          enabled: true,
          managed: true,
        },
      },
    };

    const account = resolveWorkspaceChatAccount(cfg, "default");

    assert.equal(account.configured, true);
    assert.equal(hasConfiguredWorkspaceChatRuntime(), true);
  } finally {
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

test("otto-workspace-chat stays unconfigured without managed channel state", async () => {
  const previousBaseUrl = process.env.OTTO_CONTROL_PLANE_BASE_URL;
  const previousTenantToken = process.env.TENANT_TOKEN;

  process.env.OTTO_CONTROL_PLANE_BASE_URL = "https://workspace.example";
  process.env.TENANT_TOKEN = "tenant-token";

  try {
    const cfg = {
      channels: {
        "otto-workspace-chat": {
          enabled: true,
        },
      },
    };

    const account = resolveWorkspaceChatAccount(cfg, "default");

    assert.equal(account.configured, false);
    assert.equal(hasConfiguredWorkspaceChatRuntime(), true);
  } finally {
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

test("otto-workspace-chat posts assistant completions back to the workspace API", async () => {
  const previousBaseUrl = process.env.OTTO_CONTROL_PLANE_BASE_URL;
  const previousTenantToken = process.env.TENANT_TOKEN;
  const previousFetch = globalThis.fetch;
  const calls = [];

  process.env.OTTO_CONTROL_PLANE_BASE_URL = "https://workspace.example";
  process.env.TENANT_TOKEN = "tenant-token";
  globalThis.fetch = async (url, init) => {
    calls.push({
      body: init?.body,
      headers: init?.headers,
      method: init?.method,
      url,
    });

    return new Response(
      JSON.stringify({
        conversationId: "conv_1",
        messageId: "msg_assistant_1",
        ok: true,
        runtimeSegmentId: "segment_1",
        tenantId: "tenant_1",
      }),
      {
        headers: {
          "content-type": "application/json",
        },
        status: 200,
      },
    );
  };

  try {
    const result = await sendWorkspaceChatText({
      accountId: "default",
      text: "Here is the answer.",
      to: "workspace:conv_1",
    });

    assert.deepEqual(result, {
      channel: "otto-workspace-chat",
      messageId: "msg_assistant_1",
    });
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      "https://workspace.example/api/internal/runtime/workspace-chat/messages/complete",
    );
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].headers, {
      authorization: "Bearer tenant-token",
      "content-type": "application/json",
    });
    assert.deepEqual(JSON.parse(calls[0].body), {
      assistantDisplayName: "Otto",
      conversationId: "conv_1",
      message: {
        parts: [
          {
            text: "Here is the answer.",
            type: "text",
          },
        ],
      },
      session: {
        sessionKey: "workspace:conv_1",
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

test("otto-workspace-chat preserves personal chat targets in completion callbacks", async () => {
  const previousBaseUrl = process.env.OTTO_CONTROL_PLANE_BASE_URL;
  const previousTenantToken = process.env.TENANT_TOKEN;
  const previousFetch = globalThis.fetch;
  const calls = [];

  process.env.OTTO_CONTROL_PLANE_BASE_URL = "https://workspace.example";
  process.env.TENANT_TOKEN = "tenant-token";
  globalThis.fetch = async (url, init) => {
    calls.push({
      body: init?.body,
      headers: init?.headers,
      method: init?.method,
      url,
    });

    return new Response(
      JSON.stringify({
        conversationId: "conv_1",
        messageId: "msg_assistant_1",
        ok: true,
        runtimeSegmentId: "segment_1",
        tenantId: "tenant_1",
      }),
      {
        headers: {
          "content-type": "application/json",
        },
        status: 200,
      },
    );
  };

  try {
    const result = await sendWorkspaceChatText({
      accountId: "default",
      text: "Here is the answer.",
      to: "workspace:conv_1?visibility=personal",
    });

    assert.deepEqual(result, {
      channel: "otto-workspace-chat",
      messageId: "msg_assistant_1",
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(JSON.parse(calls[0].body), {
      assistantDisplayName: "Otto",
      conversationId: "conv_1",
      message: {
        parts: [
          {
            text: "Here is the answer.",
            type: "text",
          },
        ],
      },
      session: {
        sessionKey: "workspace:conv_1?visibility=personal",
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
