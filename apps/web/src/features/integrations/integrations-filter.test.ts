import { describe, expect, it } from "vitest"
import { filterIntegrationCatalogEntries } from "./integrations-filter"
import type { WorkspaceIntegrationCatalogEntry } from "./types"

function buildIntegration(
  input: Pick<
    WorkspaceIntegrationCatalogEntry,
    "connected" | "description" | "key" | "label"
  >,
): WorkspaceIntegrationCatalogEntry {
  return {
    categoryLabel: "Product",
    iconSrc: null,
    managementMode: "workspace_managed",
    needsAttention: false,
    settingsPath: `/otto/settings/agent/integrations/${input.key}/status`,
    ...input,
  }
}

describe("filterIntegrationCatalogEntries", () => {
  it("filters integrations by installation state", () => {
    const integrations = [
      buildIntegration({
        connected: true,
        description: "Messaging",
        key: "slack",
        label: "Slack",
      }),
      buildIntegration({
        connected: false,
        description: "Issue tracking",
        key: "linear",
        label: "Linear",
      }),
    ]

    expect(
      filterIntegrationCatalogEntries(integrations, {
        installState: "installed",
        searchQuery: "",
      }).map((entry) => entry.key),
    ).toEqual(["slack"])
    expect(
      filterIntegrationCatalogEntries(integrations, {
        installState: "not-installed",
        searchQuery: "",
      }).map((entry) => entry.key),
    ).toEqual(["linear"])
  })

  it("combines installation state with text search", () => {
    const integrations = [
      buildIntegration({
        connected: true,
        description: "Search the web",
        key: "brave",
        label: "Brave Search",
      }),
      buildIntegration({
        connected: true,
        description: "Messaging",
        key: "slack",
        label: "Slack",
      }),
      buildIntegration({
        connected: false,
        description: "Product analytics",
        key: "posthog",
        label: "PostHog",
      }),
    ]

    expect(
      filterIntegrationCatalogEntries(integrations, {
        installState: "installed",
        searchQuery: "search",
      }).map((entry) => entry.key),
    ).toEqual(["brave"])
  })
})
