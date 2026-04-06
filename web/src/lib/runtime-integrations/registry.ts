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

export type RuntimeIntegrationManifestOperation = {
  description: string;
  key: string;
  label: string;
};

export type RuntimeIntegrationManifestEntry = {
  description: string;
  key: string;
  label: string;
  operations: RuntimeIntegrationManifestOperation[];
  parametersSchema: Record<string, unknown>;
  toolDescription: string;
  toolName: string;
};

type RuntimeIntegrationRegistryEntry = RuntimeIntegrationManifestEntry;

const registry: Record<string, RuntimeIntegrationRegistryEntry> = {
  "demo-linear": {
    description:
      "Synthetic managed integration used to prove Otto's first integration manifest and tool-registration path.",
    key: "demo-linear",
    label: "Demo Linear",
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
};

export function listSupportedRuntimeIntegrationKeys() {
  return Object.keys(registry).sort();
}

export function buildRuntimeIntegrationManifestForKeys(keys: string[]) {
  const manifest: RuntimeIntegrationManifestEntry[] = [];
  const seen = new Set<string>();

  for (const rawKey of keys) {
    const key = normalizeKey(rawKey);

    if (!key || seen.has(key)) {
      continue;
    }

    const entry = registry[key];

    if (!entry) {
      continue;
    }

    seen.add(key);
    manifest.push(cloneEntry(entry));
  }

  manifest.sort((left, right) => left.key.localeCompare(right.key));

  return manifest;
}

export function executeRuntimeIntegrationStub(input: {
  integrationKey: string;
  params: Record<string, unknown>;
}) {
  const integrationKey = normalizeKey(input.integrationKey);

  if (integrationKey !== "demo-linear") {
    throw new Error(`Unsupported managed integration: ${input.integrationKey}`);
  }

  return executeDemoLinear(input.params);
}

function executeDemoLinear(params: Record<string, unknown>) {
  if (params.operation !== "search_issues") {
    throw new Error("demo-linear only supports the search_issues operation.");
  }

  const query =
    typeof params.query === "string" ? params.query.trim().toLowerCase() : "";

  if (!query) {
    throw new Error("demo-linear search_issues requires a non-empty query.");
  }

  const limit =
    typeof params.limit === "number" &&
    Number.isInteger(params.limit) &&
    params.limit >= 1 &&
    params.limit <= 10
      ? params.limit
      : 5;

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
}

function cloneEntry(entry: RuntimeIntegrationRegistryEntry) {
  return {
    ...entry,
    operations: entry.operations.map((operation) => ({ ...operation })),
    parametersSchema: JSON.parse(JSON.stringify(entry.parametersSchema)),
  };
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}
