import type { IntegrationDefinition } from "@/integrations/framework/types";
import type { AgentCapabilityDirection } from "@/tools/types";
import { linearOAuthProvider } from "./oauth/provider";
import { executeLinearSearchIssues } from "./runtime/execute";
import { LinearIntegrationListItem } from "./ui/list-item";

const LINEAR_TOOL_PARAMETERS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    operation: {
      type: "string",
      const: "search_issues",
      description: "The Linear operation to execute.",
    },
    query: {
      type: "string",
      minLength: 1,
      description: "Free-text issue search query.",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 25,
      description: "Maximum number of issues to return.",
    },
  },
  required: ["operation", "query"],
} as const;

export const linearIntegrationDefinition: IntegrationDefinition = {
  agentCapabilities: [
    buildCapability({
      description:
        "Search issues across Linear projects, teams, assignees, and states.",
      direction: "read",
      key: "search_issues",
      label: "Search issues",
    }),
    buildCapability({
      description:
        "Read project, cycle, and issue details before Otto suggests work or reports status.",
      direction: "read",
      key: "read_issue_context",
      label: "Read issue context",
    }),
    buildCapability({
      description:
        "Create issues and draft follow-up work items from conversations when the workspace allows it.",
      direction: "tool",
      key: "create_issue",
      label: "Create issues",
    }),
    buildCapability({
      description:
        "Add comments or update issue status after Otto summarizes work or proposes next steps.",
      direction: "tool",
      key: "update_issue",
      label: "Update issues",
    }),
  ],
  categoryLabel: "Product Management",
  catalogDescription:
    "Connect Linear so Otto can search issue work, summarize status, and help draft follow-up actions.",
  description:
    "Workspace-managed Linear connection for issue search, issue context, and follow-up actions.",
  iconSrc: "/integrations/linear.svg",
  key: "linear",
  label: "Linear",
  oauth: {
    provider: linearOAuthProvider,
  },
  pageDescription:
    "Connect Linear so Otto can search issue work, summarize status, and help draft follow-up actions for your team.",
  runtimeTool: {
    operations: [
      {
        description:
          "Search issues across Linear projects, teams, assignees, and states.",
        key: "search_issues",
        label: "Search issues",
        parametersSchema: LINEAR_TOOL_PARAMETERS_SCHEMA,
        validate: (params) => {
          const query =
            typeof params.query === "string" ? params.query.trim() : "";

          if (!query) {
            throw new Error("linear search_issues requires a non-empty query.");
          }

          const limit =
            typeof params.limit === "number" &&
            Number.isInteger(params.limit) &&
            params.limit >= 1 &&
            params.limit <= 25
              ? params.limit
              : 10;

          return {
            limit,
            operation: "search_issues",
            query,
          };
        },
        execute: executeLinearSearchIssues,
      },
    ],
    toolDescription:
      "Search Linear issues through Otto's managed integration runtime surface.",
    toolName: "linear",
  },
  settingsPath: (orgSlug) => `/${orgSlug}/integrations/linear`,
  showInWorkspaceCatalog: true,
  ui: {
    loadDetailPage: async () =>
      (await import("./ui/page")).LinearIntegrationPage,
    overviewItem: LinearIntegrationListItem,
  },
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
