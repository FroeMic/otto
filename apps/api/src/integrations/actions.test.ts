import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  buildDisconnectedDesiredStateConfig,
  resolvePostHogSetupApiKey,
} from "./actions"

describe("buildDisconnectedDesiredStateConfig", () => {
  it("removes slack from integrations and clears the slack config block", () => {
    const nextConfig = buildDisconnectedDesiredStateConfig({
      configJson: {
        integrations: ["slack", "linear"],
        locale: "en-US",
        managedConfigVersion: 7,
        slack: {
          allowedChannelIds: ["C123"],
          teamId: "T123",
        },
      },
      providerKey: "slack",
    })

    assert.deepEqual(nextConfig, {
      integrations: ["linear"],
      locale: "en-US",
      managedConfigVersion: 7,
    })
  })

  it("removes linear without disturbing unrelated desired state fields", () => {
    const nextConfig = buildDisconnectedDesiredStateConfig({
      configJson: {
        integrations: ["linear", "brave"],
        locale: "en-US",
        managedConfigVersion: 7,
        media: {
          audio: {
            enabled: true,
          },
        },
      },
      providerKey: "linear",
    })

    assert.deepEqual(nextConfig, {
      integrations: ["brave"],
      locale: "en-US",
      managedConfigVersion: 7,
      media: {
        audio: {
          enabled: true,
        },
      },
    })
  })
})

describe("resolvePostHogSetupApiKey", () => {
  it("uses an explicitly entered key when present", () => {
    assert.equal(
      resolvePostHogSetupApiKey({
        providedApiKey: "  phx_fresh  ",
        storedApiKey: "phx_stored",
      }),
      "phx_fresh",
    )
  })

  it("falls back to the stored connected key when the browser omits the key", () => {
    assert.equal(
      resolvePostHogSetupApiKey({
        providedApiKey: undefined,
        storedApiKey: "phx_stored",
      }),
      "phx_stored",
    )
  })

  it("requires a key when no connected key exists", () => {
    assert.throws(
      () =>
        resolvePostHogSetupApiKey({
          providedApiKey: undefined,
          storedApiKey: null,
        }),
      /Enter a PostHog API key/,
    )
  })
})
