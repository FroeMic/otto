import type { IntegrationDefinition } from "../../framework";

const DOMAIN_ARGUMENT_SCHEMA = {
  type: "string",
  minLength: 1,
  description: "Fully qualified domain name to inspect or check.",
} as const;

const DOMAIN_ARRAY_ARGUMENT_SCHEMA = {
  type: "array",
  minItems: 1,
  maxItems: 50,
  items: {
    type: "string",
    minLength: 1,
  },
  description: "Domain names to check in one batch.",
} as const;

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
              type: "object",
              additionalProperties: false,
              properties: {
                domains: DOMAIN_ARRAY_ARGUMENT_SCHEMA,
              },
              required: ["domains"],
            },
            commandKey: "domain.check_availability",
            commandPath: ["domain", "check_availability"],
            description:
              "Check whether one or more exact candidate domains are available.",
            exampleArguments: {
              domains: ["ledgerpilot.com", "ledgerpilot.ai"],
            },
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
            execute: async ({ arguments: args }) => ({
              domains: (args.domains as string[]).map((domain) => ({
                availability: "unknown",
                domain,
              })),
            }),
          },
          {
            activityPresentation: {
              kind: "search",
              title: "Batch check startup domains",
            },
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                domains: DOMAIN_ARRAY_ARGUMENT_SCHEMA,
              },
              required: ["domains"],
            },
            commandKey: "domain.batch_check",
            commandPath: ["domain", "batch_check"],
            description:
              "Batch-check startup domain options for naming and shortlist evaluation workflows.",
            exampleArguments: {
              domains: [
                "ledgerpilot.com",
                "ledgerpilot.ai",
                "ledgerpilot.co",
              ],
            },
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
            execute: async ({ arguments: args }) => ({
              domains: (args.domains as string[]).map((domain) => ({
                availability: "unknown",
                domain,
              })),
            }),
          },
          {
            activityPresentation: {
              kind: "read",
              title: "Read domain details",
            },
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                domain: DOMAIN_ARGUMENT_SCHEMA,
              },
              required: ["domain"],
            },
            commandKey: "domain.get_details",
            commandPath: ["domain", "get_details"],
            description:
              "Read detailed metadata for a domain to understand its current state and practical viability.",
            exampleArguments: {
              domain: "ledgerpilot.com",
            },
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
            execute: async ({ arguments: args }) => ({
              domain: args.domain,
              status: "unknown",
            }),
          },
          {
            activityPresentation: {
              kind: "read",
              title: "Read registration metadata",
            },
            argumentsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                domain: DOMAIN_ARGUMENT_SCHEMA,
              },
              required: ["domain"],
            },
            commandKey: "domain.get_registration_metadata",
            commandPath: ["domain", "get_registration_metadata"],
            description:
              "Read structured registration metadata for a domain when evaluating name and ownership options.",
            exampleArguments: {
              domain: "ledgerpilot.com",
            },
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
            execute: async ({ arguments: args }) => ({
              domain: args.domain,
              registrationStatus: "unknown",
            }),
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
};
