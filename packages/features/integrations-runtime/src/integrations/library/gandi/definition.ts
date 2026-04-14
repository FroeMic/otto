import type { IntegrationDefinition } from "../../framework";
import {
  checkGandiDomainAvailability,
  getGandiDomainDetails,
  getGandiDomainRegistrationMetadata,
} from "./client";

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
    "Help founders evaluate company names, check domain availability, and inspect registration metadata through Otto's managed Gandi integration.",
  description:
    "Workspace-managed founder naming and domain research integration for company-name evaluation, domain checks, and metadata inspection.",
  iconSrc: "/integrations/gandi.svg",
  key: "gandi",
  label: "Gandi",
  managementMode: "workspace_managed",
  pageDescription:
    "Enable Gandi so Otto can help with company naming, domain checks, and registration research in this workspace.",
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
            effect: "read",
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
              domains: await checkGandiDomainAvailability(
                args.domains as string[],
              ),
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
            effect: "read",
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
              "company naming",
              "brand naming",
              "founder naming",
              "domain options",
              "batch domain check",
              "good domains",
              "evaluate startup names",
              "evaluate company names",
            ],
            label: "Batch check domains",
            resultMode: "json",
            usageNotes: [
              "Use this after narrowing to plausible name candidates instead of checking domains one by one.",
            ],
            execute: async ({ arguments: args }) => ({
              domains: await checkGandiDomainAvailability(
                args.domains as string[],
              ),
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
            effect: "read",
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
            execute: async ({ arguments: args }) =>
              getGandiDomainDetails(args.domain as string),
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
            effect: "read",
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
            execute: async ({ arguments: args }) =>
              getGandiDomainRegistrationMetadata(args.domain as string),
          },
        ],
        description:
          "Domain research commands for founder naming, candidate evaluation, and domain inspection.",
        groupKey: "domain",
        groupPath: ["domain"],
        intentKeywords: [
          "startup naming",
          "company naming",
          "brand naming",
          "founder naming",
          "domain research",
          "domain availability",
          "good startup names",
          "good company names",
        ],
        label: "Domain",
      },
    ],
    rootCommands: [],
    toolDescription:
      "Use Gandi for founder naming and domain research when the workspace has enabled it. Prefer domain.batch_check for company-name shortlist evaluation, then inspect finalists with domain.get_details or domain.get_registration_metadata.",
    toolName: "gandi",
  },
  settingsPath: (orgSlug) =>
    `/${orgSlug}/settings/agent/integrations/gandi/status`,
  showInWorkspaceCatalog: true,
};
