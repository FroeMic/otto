import { describe, expect, it } from "vitest"

import {
  buildIntegrationDependencyOptions,
  buildSkillDependencyOptions,
  filterDependencySelectOptions,
  toggleDependencySelection,
} from "./dependency-select-options"

describe("dependency select options", () => {
  it("builds integration options with installation state from the workspace catalog", () => {
    const options = buildIntegrationDependencyOptions({
      catalog: [
        {
          categoryLabel: "Messaging",
          connected: true,
          description: "Team messaging",
          iconSrc: "/integrations/slack.svg",
          key: "slack",
          label: "Slack",
          managementMode: "workspace_managed",
          needsAttention: false,
          settingsPath: "/otto/settings/agent/integrations/slack/status",
        },
      ],
      knownIntegrationKeys: ["gandi", "slack"],
    })

    expect(options).toEqual([
      {
        iconSrc: "/integrations/slack.svg",
        installed: true,
        label: "Slack",
        searchText: "Slack slack",
        value: "slack",
      },
      {
        iconSrc: null,
        installed: false,
        label: "gandi",
        searchText: "gandi gandi",
        value: "gandi",
      },
    ])
  })

  it("builds skill options with display names when available", () => {
    const options = buildSkillDependencyOptions({
      knownSkillKeys: ["ops", "name-and-domain-research"],
      skills: [
        {
          description: "Naming workflow",
          displayName: "Name and domain research",
          editable: false,
          enabled: true,
          origin: "from_library",
          removable: true,
          resettable: true,
          skillKey: "name-and-domain-research",
          status: "ready",
          updatedAt: "2026-04-18T00:00:00.000Z",
        },
      ],
    })

    expect(options).toEqual([
      {
        label: "Name and domain research",
        searchText: "Name and domain research name-and-domain-research",
        value: "name-and-domain-research",
      },
      {
        label: "ops",
        searchText: "ops ops",
        value: "ops",
      },
    ])
  })

  it("filters options by label or value", () => {
    const options = [
      { label: "Slack", searchText: "Slack slack", value: "slack" },
      { label: "Linear", searchText: "Linear linear", value: "linear" },
    ]

    expect(filterDependencySelectOptions(options, "lin")).toEqual([options[1]])
    expect(filterDependencySelectOptions(options, "SLACK")).toEqual([options[0]])
  })

  it("toggles selected values without duplicates and keeps them sorted", () => {
    expect(toggleDependencySelection(["slack"], "linear")).toEqual([
      "linear",
      "slack",
    ])
    expect(toggleDependencySelection(["linear", "slack"], "linear")).toEqual([
      "slack",
    ])
  })
})
