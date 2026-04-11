import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_AGENT_ID,
  resolveWorkspaceChatAgentRuntime,
} from "./workspace-chat-agent-runtime.mjs";

test("resolveWorkspaceChatAgentRuntime uses main defaults when no agent list exists", () => {
  const runtime = resolveWorkspaceChatAgentRuntime({
    cfg: {
      agents: {
        defaults: {
          model: {
            primary: "openai-proxy/gpt-5.4",
          },
          workspace: "/home/node/.openclaw/workspace",
        },
      },
    },
    env: {
      HOME: "/home/node",
      OPENCLAW_HOME: "/home/node/.openclaw",
    },
  });

  assert.equal(runtime.agentId, DEFAULT_AGENT_ID);
  assert.equal(runtime.agentDir, "/home/node/.openclaw/agents/main/agent");
  assert.equal(runtime.workspaceDir, "/home/node/.openclaw/workspace");
  assert.equal(runtime.provider, "openai-proxy");
  assert.equal(runtime.model, "gpt-5.4");
});

test("resolveWorkspaceChatAgentRuntime prefers the first default=true agent", () => {
  const runtime = resolveWorkspaceChatAgentRuntime({
    cfg: {
      agents: {
        defaults: {
          model: {
            primary: "openai-proxy/gpt-5.4",
          },
          workspace: "/home/node/.openclaw/workspace",
        },
        list: [
          {
            id: "secondary",
          },
          {
            default: true,
            id: "writer",
            workspace: "/srv/writer-workspace",
            agentDir: "/srv/writer-agent",
            model: {
              primary: "anthropic/claude-sonnet-4-6",
            },
          },
        ],
      },
    },
    env: {
      HOME: "/home/node",
      OPENCLAW_HOME: "/home/node/.openclaw",
    },
  });

  assert.equal(runtime.agentId, "writer");
  assert.equal(runtime.agentDir, "/srv/writer-agent");
  assert.equal(runtime.workspaceDir, "/srv/writer-workspace");
  assert.equal(runtime.provider, "anthropic");
  assert.equal(runtime.model, "claude-sonnet-4-6");
});

test("resolveWorkspaceChatAgentRuntime falls back to default provider/model when config omits them", () => {
  const runtime = resolveWorkspaceChatAgentRuntime({
    cfg: {},
    env: {
      HOME: "/home/node",
      OPENCLAW_HOME: "/var/lib/openclaw",
    },
  });

  assert.equal(runtime.agentId, DEFAULT_AGENT_ID);
  assert.equal(runtime.agentDir, "/var/lib/openclaw/agents/main/agent");
  assert.equal(runtime.workspaceDir, "/var/lib/openclaw/workspace");
  assert.equal(runtime.provider, "openai");
  assert.equal(runtime.model, "gpt-5.4");
});
