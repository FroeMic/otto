import type { IntegrationDefinition } from "@/integrations/framework/types";
import type { AgentCapabilityDirection } from "@/tools/types";

const DEMO_LINEAR_TOOL_PARAMETERS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    operation: {
      type: "string",
      const: "search_issues",
      description: "The demo Linear operation to execute.",
    },
    query: {
      type: "string",
      minLength: 1,
      description: "Free-text issue search query.",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 10,
      description: "Maximum number of demo issues to return.",
    },
  },
  required: ["operation", "query"],
} as const;

const DEMO_LINEAR_ISSUES = [
  {
    assignee: "Mina",
    id: "DEMO-101",
    priority: 1,
    project: "Core",
    state: "Backlog",
    title: "Fix OAuth callback state mismatch during onboarding",
  },
  {
    assignee: "Sam",
    id: "DEMO-102",
    priority: 2,
    project: "Core",
    state: "In Progress",
    title: "Investigate runtime plugin manifest cache busting",
  },
  {
    assignee: "June",
    id: "DEMO-103",
    priority: 3,
    project: "Growth",
    state: "Todo",
    title: "Polish workspace integration card copy for Linear setup",
  },
] as const;

export const demoLinearIntegrationDefinition: IntegrationDefinition = {
  agentCapabilities: [
    buildCapability({
      description:
        "Search a synthetic issue dataset through Otto's managed integration execution path.",
      direction: "read",
      key: "search_issues",
      label: "Search Issues",
    }),
  ],
  categoryLabel: "Product Management",
  catalogDescription:
    "Synthetic managed integration used to prove Otto's first integration manifest and tool-registration path.",
  description:
    "Synthetic managed integration used to prove Otto's first integration manifest and tool-registration path.",
  iconSrc: "/integrations/linear.svg",
  key: "demo-linear",
  label: "Demo Linear",
  pageDescription:
    "Use this synthetic provider to verify the managed integration manifest, runtime tool registration, and stubbed execution path.",
  runtimeTool: {
    operations: [
      {
        description:
          "Search a fixed synthetic issue dataset through Otto's managed integration execution path.",
        exampleArguments: {
          limit: 5,
          query: "oauth",
        },
        intentKeywords: ["demo", "issues", "synthetic", "test"],
        key: "search_issues",
        label: "Search Issues",
        parametersSchema: DEMO_LINEAR_TOOL_PARAMETERS_SCHEMA,
        usageNotes: [
          "This is a synthetic dataset for testing the managed integration workflow.",
        ],
        validate: (params) => {
          const query =
            typeof params.query === "string"
              ? params.query.trim().toLowerCase()
              : "";

          if (!query) {
            throw new Error(
              "demo-linear search_issues requires a non-empty query.",
            );
          }

          const limit =
            typeof params.limit === "number" &&
            Number.isInteger(params.limit) &&
            params.limit >= 1 &&
            params.limit <= 10
              ? params.limit
              : 5;

          return {
            limit,
            operation: "search_issues",
            query,
          };
        },
        execute: async ({ params }) => {
          const query = typeof params.query === "string" ? params.query : "";
          const limit = typeof params.limit === "number" ? params.limit : 5;

          const items = DEMO_LINEAR_ISSUES.filter((issue) => {
            const haystack =
              `${issue.id} ${issue.title} ${issue.project} ${issue.state} ${issue.assignee}`.toLowerCase();
            return haystack.includes(query);
          }).slice(0, limit);

          return {
            integrationKey: "demo-linear",
            items,
            operation: "search_issues",
            query,
            source: "stub",
            totalMatched: items.length,
          };
        },
      },
    ],
    toolDescription:
      "Search demo Linear issues through Otto's managed integration manifest and execution path.",
    toolName: "demo_linear",
  },
  settingsPath: (orgSlug) => `/${orgSlug}/integrations/demo-linear`,
  showInWorkspaceCatalog: false,
};

function buildCapability(input: {
  description: string;
  direction: AgentCapabilityDirection;
  key: string;
  label: string;
}) {
  return {
    description: input.description,
    direction: input.direction,
    key: input.key,
    label: input.label,
    source: "integration" as const,
  };
}
