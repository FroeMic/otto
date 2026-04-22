import assert from "node:assert/strict"

import { describe, expect, it } from "vitest"

import { __testing as envTesting } from "../env"
import {
  buildOpenClawTenantConfig,
  type OpenClawTenantConfig,
  renderOpenClawConfig,
} from "./config"

function buildConfig(): OpenClawTenantConfig {
  return {
    authTokenEnvVar: "OPENCLAW_GATEWAY_TOKEN",
    gatewayPort: 18789,
    integrations: [],
    ottoPlugins: [
      {
        id: "otto-managed-config",
        timeoutMs: 15_000,
      },
      {
        id: "otto-workspace-chat",
      },
    ],
    prompts: {},
    tenantId: "tenant_test",
    workspacePath: "/home/node/.openclaw/workspace",
  }
}

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}

function saveEnvVars(names: string[]) {
  return Object.fromEntries(names.map((name) => [name, process.env[name]]))
}

describe("renderOpenClawConfig", () => {
  it("builds a tenant config when web search config is absent", () => {
    const previousDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto"
    envTesting.resetEnvCacheForTests()
    try {
      const config = buildOpenClawTenantConfig({
        configJson: {},
        tenantId: "tenant_test",
      })

      expect(config.webSearch).toBeUndefined()
      expect(config.tenantId).toBe("tenant_test")
    } finally {
      process.env.DATABASE_URL = previousDatabaseUrl
      envTesting.resetEnvCacheForTests()
    }
  })

  it("honors Otto plugins declared in desired state config", () => {
    const previousEnv = saveEnvVars([
      "DATABASE_URL",
      "LANDING_PAGE_DOMAIN",
      "WORKOS_BASE_URL",
      "WORKOS_REDIRECT_URI",
      "SLACK_REDIRECT_URI",
      "NEXT_PUBLIC_WORKOS_REDIRECT_URI",
    ])

    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto"
    delete process.env.LANDING_PAGE_DOMAIN
    delete process.env.WORKOS_BASE_URL
    delete process.env.WORKOS_REDIRECT_URI
    delete process.env.SLACK_REDIRECT_URI
    delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
    envTesting.resetEnvCacheForTests()

    try {
      const config = buildOpenClawTenantConfig({
        configJson: {
          ottoPlugins: [{ id: "otto-workspace-chat" }],
        },
        tenantId: "tenant_test",
      })
      const rendered = JSON.parse(renderOpenClawConfig(config)) as {
        channels: Record<string, { enabled: boolean; managed?: boolean }>
        plugins: {
          entries: Record<string, { enabled: boolean }>
        }
      }

      expect(rendered.plugins.entries["otto-workspace-chat"]).toEqual({
        enabled: true,
      })
      expect(rendered.channels["otto-workspace-chat"]).toEqual({
        enabled: true,
        managed: true,
      })
    } finally {
      for (const [name, value] of Object.entries(previousEnv)) {
        restoreEnvVar(name, value)
      }
      envTesting.resetEnvCacheForTests()
    }
  })

  it("omits plugin config fields when a plugin does not declare them and enables the workspace channel", () => {
    const rendered = JSON.parse(renderOpenClawConfig(buildConfig())) as {
      channels: Record<string, { enabled: boolean; managed?: boolean }>
      plugins: {
        entries: Record<
          string,
          { config?: Record<string, unknown>; enabled: boolean }
        >
      }
      tools: Record<string, unknown>
    }

    expect(rendered.plugins.entries["otto-managed-config"]).toEqual({
      config: { timeoutMs: 15_000 },
      enabled: true,
    })
    expect(rendered.plugins.entries["otto-workspace-chat"]).toEqual({
      enabled: true,
    })
    assert.equal(
      "config" in rendered.plugins.entries["otto-workspace-chat"],
      false,
    )
    expect(rendered.channels["otto-workspace-chat"]).toEqual({
      enabled: true,
      managed: true,
    })
    expect(rendered.tools.alsoAllow).toEqual(["otto-managed-config"])
  })

  it("renders multi-attachment audio transcription mode", () => {
    const rendered = JSON.parse(
      renderOpenClawConfig({
        ...buildConfig(),
        audio: {
          attachmentsMode: "all",
          echoTranscript: false,
          enabled: true,
          maxBytes: 20 * 1024 * 1024,
          models: [{ model: "gpt-4o-mini-transcribe", provider: "openai" }],
        },
      }),
    ) as {
      tools: {
        media?: {
          audio?: {
            attachments?: {
              maxAttachments?: number
              mode?: string
            }
            enabled?: boolean
          }
        }
      }
    }

    expect(rendered.tools.media?.audio).toMatchObject({
      attachments: {
        maxAttachments: 10,
        mode: "all",
      },
      enabled: true,
    })
  })

  it("honors desired audio max attachment count", () => {
    const previousEnv = saveEnvVars([
      "DATABASE_URL",
      "OTTO_OPENAI_PROXY_BASE_URL",
    ])

    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto"
    process.env.OTTO_OPENAI_PROXY_BASE_URL = "http://api.local"
    envTesting.resetEnvCacheForTests()

    try {
      const config = buildOpenClawTenantConfig({
        configJson: {
          media: {
            audio: {
              attachmentsMode: "all",
              echoTranscript: false,
              enabled: true,
              maxAttachments: 4,
              model: "gpt-4o-mini-transcribe",
              provider: "openai",
            },
          },
        },
        tenantId: "tenant_test",
      })
      const rendered = JSON.parse(renderOpenClawConfig(config)) as {
        tools: {
          media?: {
            audio?: {
              attachments?: {
                maxAttachments?: number
                mode?: string
              }
            }
          }
        }
      }

      expect(rendered.tools.media?.audio?.attachments).toEqual({
        maxAttachments: 4,
        mode: "all",
      })
    } finally {
      for (const [name, value] of Object.entries(previousEnv)) {
        restoreEnvVar(name, value)
      }
      envTesting.resetEnvCacheForTests()
    }
  })

  it("allowlists optional Otto tool plugins without including non-tool plugins", () => {
    const rendered = JSON.parse(
      renderOpenClawConfig({
        ...buildConfig(),
        ottoPlugins: [
          {
            id: "otto-managed-config",
            timeoutMs: 15_000,
          },
          {
            id: "otto-managed-skills",
            timeoutMs: 15_000,
          },
          {
            id: "otto-integrations",
            timeoutMs: 15_000,
          },
          {
            id: "otto-session-reporter",
            timeoutMs: 15_000,
          },
          {
            id: "otto-workspace-chat",
          },
        ],
      }),
    ) as {
      tools: {
        alsoAllow?: string[]
      }
    }

    expect(rendered.tools.alsoAllow).toEqual([
      "otto-managed-config",
      "otto-managed-skills",
      "otto-integrations",
    ])
  })

  it("enables the bundled Slack plugin when Slack HTTP ingress is configured", () => {
    const rendered = JSON.parse(
      renderOpenClawConfig({
        ...buildConfig(),
        slack: {
          ackReactionEnabled: false,
          allowedChannelIds: [],
          allowedUserIds: [],
          answerInThreads: true,
          channelAccessMode: "member_of_channels",
          enabled: true,
          mode: "http",
          requireMentionInChannels: true,
          signingSecret: "signing-secret",
          webhookPath: "/slack/events",
        },
      }),
    ) as {
      channels: {
        slack?: {
          enabled?: boolean
          mode?: string
          webhookPath?: string
        }
      }
      plugins: {
        allow?: string[]
        entries: Record<string, { enabled: boolean }>
      }
    }

    expect(rendered.channels.slack).toMatchObject({
      enabled: true,
      mode: "http",
      webhookPath: "/slack/events",
    })
    expect(rendered.plugins.allow).toContain("slack")
    expect(rendered.plugins.entries.slack).toEqual({ enabled: true })
  })

  it("projects openai-proxy model provider against the dedicated proxy base URL placeholder", () => {
    const previousEnv = saveEnvVars([
      "DATABASE_URL",
      "LANDING_PAGE_DOMAIN",
      "OTTO_OPENAI_PROXY_BASE_URL",
      "RUNTIME_MODEL_PRIMARY",
    ])

    process.env.DATABASE_URL =
      "postgres://postgres:postgres@localhost:5432/otto"
    process.env.LANDING_PAGE_DOMAIN = "getyourotto.com"
    process.env.OTTO_OPENAI_PROXY_BASE_URL = "http://116.203.190.123:3002"
    process.env.RUNTIME_MODEL_PRIMARY = "openai-proxy/gpt-5.4"
    envTesting.resetEnvCacheForTests()

    try {
      const config = buildOpenClawTenantConfig({
        configJson: {},
        tenantId: "tenant_test",
      })
      const rendered = JSON.parse(renderOpenClawConfig(config)) as {
        models: {
          providers: Record<string, { baseUrl: string }>
        }
      }

      expect(rendered.models.providers["openai-proxy"].baseUrl).toBe(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: this asserts the literal runtime env placeholder.
        "${OTTO_OPENAI_PROXY_BASE_URL}/api/internal/runtime/ai/openai/v1",
      )
    } finally {
      for (const [name, value] of Object.entries(previousEnv)) {
        restoreEnvVar(name, value)
      }
      envTesting.resetEnvCacheForTests()
    }
  })
})
