import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { buildDisconnectedDesiredStateConfig } from "./actions"

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
