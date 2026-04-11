import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  buildBraveDefaultRows,
  buildBraveProviderRows,
  formatBraveAvailabilityLabel,
  formatBraveManagedByLabel,
  formatBraveProviderLabel,
} from "./formatters"

describe("brave formatters", () => {
  it("formats workspace-managed labels consistently with the legacy page", () => {
    assert.equal(formatBraveProviderLabel("brave"), "Brave")
    assert.equal(formatBraveProviderLabel(undefined), "Not configured")
    assert.equal(formatBraveManagedByLabel("control_plane_env"), "Workspace defaults")
    assert.equal(formatBraveAvailabilityLabel("available"), "Available")
    assert.equal(formatBraveAvailabilityLabel("blocked"), "Unavailable")
  })

  it("builds default and provider rows from the runtime config", () => {
    const config = {
      braveMode: "web",
      cacheTtlMinutes: 15,
      credentialEnvVar: "RUNTIME_BRAVE_API_KEY",
      managedBy: "control_plane_env",
      maxResults: 5,
      provider: "brave",
      timeoutSeconds: 30,
    }

    assert.deepEqual(buildBraveDefaultRows(config), [
      { title: "Default results", value: "5" },
      { title: "Timeout", value: "30s" },
      { title: "Cache TTL", value: "15 min" },
    ])

    assert.deepEqual(buildBraveProviderRows(config), [
      {
        description: "The workspace keeps the provider API key in this env var.",
        title: "API key env var",
        value: "RUNTIME_BRAVE_API_KEY",
      },
      {
        title: "Brave mode",
        value: "web",
      },
    ])
  })
})
