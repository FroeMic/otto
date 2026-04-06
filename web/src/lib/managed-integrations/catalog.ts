import type { AgentCapability, AgentCapabilityDirection } from "@/tools/types";

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

export type ManagedIntegrationOperation = {
  description: string;
  key: string;
  label: string;
};

export type ManagedIntegrationRuntimeTool = {
  operations: ManagedIntegrationOperation[];
  parametersSchema: Record<string, unknown>;
  toolDescription: string;
  toolName: string;
};

export type ManagedIntegrationDefinition = {
  agentCapabilities: AgentCapability[];
  catalogDescription: string;
  description: string;
  iconSrc: string | null;
  key: string;
  label: string;
  pageDescription: string;
  runtimeTool: ManagedIntegrationRuntimeTool | null;
  showInWorkspaceCatalog: boolean;
};

const managedIntegrationDefinitions: Record<
  string,
  ManagedIntegrationDefinition
> = {
  "demo-linear": {
    agentCapabilities: [
      buildCapability({
        description:
          "Search a synthetic issue dataset through Otto's managed integration execution path.",
        direction: "read",
        key: "search_issues",
        label: "Search Issues",
      }),
    ],
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
          key: "search_issues",
          label: "Search Issues",
        },
      ],
      parametersSchema: DEMO_LINEAR_TOOL_PARAMETERS_SCHEMA,
      toolDescription:
        "Search demo Linear issues through Otto's managed integration manifest and execution path.",
      toolName: "demo_linear",
    },
    showInWorkspaceCatalog: false,
  },
  linear: {
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
    catalogDescription:
      "Connect Linear so Otto can search issue work, summarize status, and prepare follow-up actions.",
    description:
      "Workspace-managed Linear connection for issue search, issue context, and follow-up actions.",
    iconSrc: "/integrations/linear.svg",
    key: "linear",
    label: "Linear",
    pageDescription:
      "Connect Linear so Otto can search issue work, summarize status, and prepare follow-up actions without exposing provider secrets to the tenant runtime.",
    runtimeTool: null,
    showInWorkspaceCatalog: true,
  },
};

export function getManagedIntegrationDefinition(key: string) {
  return managedIntegrationDefinitions[normalizeKey(key)] ?? null;
}

export function listManagedIntegrationDefinitions() {
  return Object.values(managedIntegrationDefinitions).sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

export function listWorkspaceManagedIntegrationDefinitions() {
  return listManagedIntegrationDefinitions().filter(
    (definition) => definition.showInWorkspaceCatalog,
  );
}

export function listRuntimeManagedIntegrationDefinitions() {
  return listManagedIntegrationDefinitions().filter(
    (
      definition,
    ): definition is ManagedIntegrationDefinition & {
      runtimeTool: ManagedIntegrationRuntimeTool;
    } => definition.runtimeTool !== null,
  );
}

function buildCapability(input: {
  description: string;
  direction: AgentCapabilityDirection;
  key: string;
  label: string;
}): AgentCapability {
  return {
    description: input.description,
    direction: input.direction,
    key: input.key,
    label: input.label,
    source: "integration",
  };
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}
