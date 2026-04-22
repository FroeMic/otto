import type { IntegrationDefinition } from "../../framework"

const DOMAIN_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Fully qualified domain name to inspect or check.",
} as const

const DOMAIN_ARRAY_ARGUMENT_SCHEMA = {
  type: "array",
  minItems: 1,
  maxItems: 50,
  items: {
    type: "string",
    minLength: 1,
  },
  description: "Domain names to check in one batch.",
} as const

async function unsupportedGandiCommandExecution() {
  throw new Error(
    "Gandi command execution is handled by the runtime integration gateway, not the worker registry.",
  )
}

export const gandiIntegrationDefinition: IntegrationDefinition = {
  agentCapabilities: [],
  categoryLabel: "Domains",
  catalogDescription:
    "Evaluate startup names, check domain availability, and inspect domain metadata through Otto's managed Gandi integration.",
  description:
    "Workspace-managed domain research integration for startup naming, domain availability checks, and domain metadata inspection.",
  iconSrc: "/integrations/gandi.svg",
  key: "gandi",
  label: "Gandi",
  managementMode: "workspace_managed",
  pageDescription:
    "Enable Gandi for this workspace so Otto can evaluate startup names and inspect domain availability.",
  runtimeSurface: {
    commandGroups: [
      {
        commands: [
          {
            activityPresentation: {
              kind: "search",
              title: "Check domain availability",
            },
            argumentsSchema: {
              additionalProperties: false,
              properties: {
                domains: DOMAIN_ARRAY_ARGUMENT_SCHEMA,
              },
              required: ["domains"],
              type: "object",
            },
            commandKey: "domain.check_availability",
            commandPath: ["domain", "check_availability"],
            description:
              "Check whether one or more exact candidate domains are available.",
            effect: "read",
            exampleArguments: {
              domains: ["ledgerpilot.com", "ledgerpilot.ai"],
            },
            execute: unsupportedGandiCommandExecution,
            inputMode: "json",
            intentKeywords: [
              "domain availability",
              "check domain",
              "startup domain",
              "domain search",
            ],
            label: "Check domain availability",
            resultMode: "json",
            usageNotes: [
              "Use this for direct checks of exact domains when you already know the candidates.",
            ],
          },
          {
            activityPresentation: {
              kind: "search",
              title: "Batch check startup domains",
            },
            argumentsSchema: {
              additionalProperties: false,
              properties: {
                domains: DOMAIN_ARRAY_ARGUMENT_SCHEMA,
              },
              required: ["domains"],
              type: "object",
            },
            commandKey: "domain.batch_check",
            commandPath: ["domain", "batch_check"],
            description:
              "Batch-check startup domain options for naming and shortlist evaluation workflows.",
            effect: "read",
            exampleArguments: {
              domains: ["ledgerpilot.com", "ledgerpilot.ai", "ledgerpilot.co"],
            },
            execute: unsupportedGandiCommandExecution,
            inputMode: "json",
            intentKeywords: [
              "startup names",
              "startup naming",
              "domain options",
              "batch domain check",
              "good domains",
              "evaluate startup names",
            ],
            label: "Batch check domains",
            resultMode: "json",
            usageNotes: [
              "Use this after narrowing to plausible name candidates instead of checking domains one by one.",
            ],
          },
          {
            activityPresentation: {
              kind: "read",
              title: "Read domain details",
            },
            argumentsSchema: {
              additionalProperties: false,
              properties: {
                domain: DOMAIN_ARGUMENT_SCHEMA,
              },
              required: ["domain"],
              type: "object",
            },
            commandKey: "domain.get_details",
            commandPath: ["domain", "get_details"],
            description:
              "Read detailed metadata for a domain to understand its current state and practical viability.",
            effect: "read",
            exampleArguments: {
              domain: "ledgerpilot.com",
            },
            execute: unsupportedGandiCommandExecution,
            inputMode: "json",
            intentKeywords: [
              "domain details",
              "inspect domain",
              "domain metadata",
            ],
            label: "Get domain details",
            resultMode: "json",
            usageNotes: [
              "Use this when you need more detail on one domain than an availability check provides.",
            ],
          },
          {
            activityPresentation: {
              kind: "read",
              title: "Read registration metadata",
            },
            argumentsSchema: {
              additionalProperties: false,
              properties: {
                domain: DOMAIN_ARGUMENT_SCHEMA,
              },
              required: ["domain"],
              type: "object",
            },
            commandKey: "domain.get_registration_metadata",
            commandPath: ["domain", "get_registration_metadata"],
            description:
              "Read structured registration metadata for a domain when evaluating name and ownership options.",
            effect: "read",
            exampleArguments: {
              domain: "ledgerpilot.com",
            },
            execute: unsupportedGandiCommandExecution,
            inputMode: "json",
            intentKeywords: [
              "registration metadata",
              "who owns domain",
              "domain registration",
            ],
            label: "Get registration metadata",
            resultMode: "json",
            usageNotes: [
              "Use this for finalist domains when you need registration-oriented metadata in addition to availability.",
            ],
          },
        ],
        description:
          "Domain research commands for startup naming, candidate evaluation, and domain inspection.",
        groupKey: "domain",
        groupPath: ["domain"],
        intentKeywords: [
          "startup naming",
          "domain research",
          "domain availability",
          "good startup names",
        ],
        label: "Domain",
      },
    ],
    rootCommands: [],
    toolDescription:
      "Use Gandi for startup naming and domain research when the workspace has enabled it. Prefer domain.batch_check for shortlist evaluation, then inspect finalists with domain.get_details or domain.get_registration_metadata.",
    toolName: "gandi",
  },
  settingsPath: (orgSlug) =>
    `/${orgSlug}/settings/agent/integrations/gandi/status`,
  showInWorkspaceCatalog: true,
}
