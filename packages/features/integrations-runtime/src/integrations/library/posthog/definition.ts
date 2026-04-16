import type {
  IntegrationCommandDefinition,
  IntegrationCommandExecute,
  IntegrationDefinition,
} from "../../framework";
import {
  buildPostHogEnvironmentPath,
  buildPostHogOrganizationPath,
  buildPostHogProjectPath,
  getPostHogAuth,
  prepareHogQlQuery,
  requestPostHog,
  resolvePostHogTarget,
} from "./client";

const TARGET_ARGUMENTS = {
  environmentId: {
    type: "string",
    minLength: 1,
    description: "Explicit PostHog environment id. Overrides targetKey.",
  },
  organizationId: {
    type: "string",
    minLength: 1,
    description: "Explicit PostHog organization id. Overrides targetKey.",
  },
  projectId: {
    type: "string",
    minLength: 1,
    description: "Explicit PostHog project id. Overrides targetKey.",
  },
  targetKey: {
    type: "string",
    minLength: 1,
    description: "Configured PostHog target key such as production or staging.",
  },
} as const;

const LIMIT_ARGUMENT = {
  type: "integer",
  minimum: 1,
  maximum: 100,
  description: "Maximum number of results to return.",
} as const;

const OFFSET_ARGUMENT = {
  type: "integer",
  minimum: 0,
  description: "Pagination offset.",
} as const;

function readCommand(input: {
  commandKey: string;
  commandPath: string[];
  description: string;
  execute: IntegrationCommandExecute;
  label: string;
  properties?: Record<string, Record<string, unknown>>;
  required?: string[];
  requiredProviderScopes: string[];
}): IntegrationCommandDefinition & { execute: IntegrationCommandExecute } {
  return {
    argumentsSchema: {
      additionalProperties: false,
      properties: {
        ...TARGET_ARGUMENTS,
        ...(input.properties ?? {}),
      },
      required: input.required ?? [],
      type: "object",
    },
    commandKey: input.commandKey,
    commandPath: input.commandPath,
    description: input.description,
    effect: "read",
    execute: input.execute,
    inputMode: "json",
    label: input.label,
    requiredProviderScopes: input.requiredProviderScopes,
    resultMode: "json",
  };
}

function listProjectResourceCommand(input: {
  commandKey: string;
  commandPath: string[];
  description: string;
  label: string;
  path: string;
  requiredProviderScopes: string[];
}) {
  return readCommand({
    ...input,
    execute: async ({ arguments: args, context }) => {
      const target = requireProjectTarget(args, getPostHogAuth(context).state);

      return requestPostHog(context, {
        path: buildPostHogProjectPath(target.projectId, input.path),
      });
    },
    properties: {
      limit: LIMIT_ARGUMENT,
      offset: OFFSET_ARGUMENT,
      search: {
        type: "string",
        minLength: 1,
        description: "Optional provider-supported search term.",
      },
    },
  });
}

function getProjectResourceCommand(input: {
  commandKey: string;
  commandPath: string[];
  description: string;
  idLabel: string;
  label: string;
  path: (id: string) => string;
  requiredProviderScopes: string[];
}) {
  return readCommand({
    ...input,
    execute: async ({ arguments: args, context }) => {
      const target = requireProjectTarget(args, getPostHogAuth(context).state);

      return requestPostHog(context, {
        path: buildPostHogProjectPath(
          target.projectId,
          input.path(String(args.id)),
        ),
      });
    },
    properties: {
      id: {
        type: "string",
        minLength: 1,
        description: input.idLabel,
      },
    },
    required: ["id"],
  });
}

function listEnvironmentResourceCommand(input: {
  commandKey: string;
  commandPath: string[];
  description: string;
  label: string;
  path: string;
  requiredProviderScopes: string[];
}) {
  return readCommand({
    ...input,
    execute: async ({ arguments: args, context }) => {
      const target = requireEnvironmentTarget(
        args,
        getPostHogAuth(context).state,
      );

      return requestPostHog(context, {
        path: buildPostHogEnvironmentPath(target.environmentId, input.path),
      });
    },
    properties: {
      limit: LIMIT_ARGUMENT,
      offset: OFFSET_ARGUMENT,
    },
  });
}

function getEnvironmentResourceCommand(input: {
  commandKey: string;
  commandPath: string[];
  description: string;
  idLabel: string;
  label: string;
  path: (id: string) => string;
  requiredProviderScopes: string[];
}) {
  return readCommand({
    ...input,
    execute: async ({ arguments: args, context }) => {
      const target = requireEnvironmentTarget(
        args,
        getPostHogAuth(context).state,
      );

      return requestPostHog(context, {
        path: buildPostHogEnvironmentPath(
          target.environmentId,
          input.path(String(args.id)),
        ),
      });
    },
    properties: {
      id: {
        type: "string",
        minLength: 1,
        description: input.idLabel,
      },
    },
    required: ["id"],
  });
}

export const posthogIntegrationDefinition: IntegrationDefinition = {
  agentCapabilities: [],
  auth: {
    credentialType: "personal_api_key",
    kind: "api_key",
  },
  categoryLabel: "Product Analytics",
  catalogDescription:
    "Connect PostHog so Otto can inspect product analytics, feature flags, experiments, dashboards, insights, and selected product activity.",
  description:
    "Workspace-managed PostHog analytics integration for product analytics reads and guarded product-operations writes.",
  iconSrc: "/integrations/posthog.svg",
  key: "posthog",
  label: "PostHog",
  managementMode: "workspace_managed",
  pageDescription:
    "Connect PostHog so Otto can answer product analytics questions, review feature flags and experiments, and inspect workspace product activity.",
  runtimeSurface: {
    commandGroups: [
      {
        commands: [
          readCommand({
            commandKey: "workspace.list_projects",
            commandPath: ["workspace", "list_projects"],
            description:
              "List PostHog projects for a configured or explicit organization.",
            execute: async ({ arguments: args, context }) => {
              const target = requireOrganizationTarget(
                args,
                getPostHogAuth(context).state,
              );

              return requestPostHog(context, {
                path: buildPostHogOrganizationPath(
                  target.organizationId,
                  "projects/",
                ),
              });
            },
            label: "List projects",
            requiredProviderScopes: ["project:read"],
          }),
          readCommand({
            commandKey: "workspace.get_project",
            commandPath: ["workspace", "get_project"],
            description: "Read one PostHog project by id.",
            execute: async ({ arguments: args, context }) => {
              const target = requireProjectTarget(
                args,
                getPostHogAuth(context).state,
              );

              return requestPostHog(context, {
                path: buildPostHogOrganizationPath(
                  target.organizationId,
                  `projects/${encodeURIComponent(target.projectId)}/`,
                ),
              });
            },
            label: "Get project",
            requiredProviderScopes: ["project:read"],
          }),
        ],
        description: "Workspace and project discovery commands.",
        groupKey: "workspace",
        groupPath: ["workspace"],
        label: "Workspace",
      },
      {
        commands: [
          listProjectResourceCommand({
            commandKey: "taxonomy.event_definition.list",
            commandPath: ["taxonomy", "event_definition", "list"],
            description: "List event definitions in a PostHog project.",
            label: "List event definitions",
            path: "event_definitions/",
            requiredProviderScopes: ["event_definition:read"],
          }),
          listProjectResourceCommand({
            commandKey: "taxonomy.property_definition.list",
            commandPath: ["taxonomy", "property_definition", "list"],
            description: "List property definitions in a PostHog project.",
            label: "List property definitions",
            path: "property_definitions/",
            requiredProviderScopes: ["property_definition:read"],
          }),
          listProjectResourceCommand({
            commandKey: "taxonomy.action.list",
            commandPath: ["taxonomy", "action", "list"],
            description: "List PostHog actions in a project.",
            label: "List actions",
            path: "actions/",
            requiredProviderScopes: ["action:read"],
          }),
        ],
        description: "Product analytics taxonomy commands.",
        groupKey: "taxonomy",
        groupPath: ["taxonomy"],
        label: "Taxonomy",
      },
      {
        commands: [
          readCommand({
            commandKey: "query.hogql",
            commandPath: ["query", "hogql"],
            description: "Run a bounded read-only HogQL query.",
            execute: async ({ arguments: args, context }) => {
              const target = requireEnvironmentTarget(
                args,
                getPostHogAuth(context).state,
              );
              const prepared = prepareHogQlQuery(
                String(args.query),
                typeof args.maxRows === "number" ? args.maxRows : 100,
              );

              return requestPostHog(context, {
                body: {
                  query: {
                    kind: "HogQLQuery",
                    query: prepared.query,
                  },
                },
                method: "POST",
                path: buildPostHogEnvironmentPath(
                  target.environmentId,
                  "query/",
                ),
              });
            },
            label: "Run HogQL",
            properties: {
              maxRows: {
                type: "integer",
                minimum: 1,
                maximum: 500,
                description: "Maximum rows to return.",
              },
              query: {
                type: "string",
                minLength: 1,
                description: "Read-only HogQL query.",
              },
            },
            required: ["query"],
            requiredProviderScopes: ["query:read"],
          }),
        ],
        description: "Bounded read-only HogQL commands.",
        groupKey: "query",
        groupPath: ["query"],
        label: "Query",
      },
      {
        commands: [
          listEnvironmentResourceCommand({
            commandKey: "insight.list",
            commandPath: ["insight", "list"],
            description: "List insights in a PostHog environment.",
            label: "List insights",
            path: "insights/",
            requiredProviderScopes: ["insight:read"],
          }),
          getEnvironmentResourceCommand({
            commandKey: "insight.get",
            commandPath: ["insight", "get"],
            description: "Read one PostHog insight.",
            idLabel: "PostHog insight id.",
            label: "Get insight",
            path: (id) => `insights/${encodeURIComponent(id)}/`,
            requiredProviderScopes: ["insight:read"],
          }),
        ],
        description: "Insight read commands.",
        groupKey: "insight",
        groupPath: ["insight"],
        label: "Insight",
      },
      {
        commands: [
          listEnvironmentResourceCommand({
            commandKey: "dashboard.list",
            commandPath: ["dashboard", "list"],
            description: "List dashboards in a PostHog environment.",
            label: "List dashboards",
            path: "dashboards/",
            requiredProviderScopes: ["dashboard:read"],
          }),
          getEnvironmentResourceCommand({
            commandKey: "dashboard.get",
            commandPath: ["dashboard", "get"],
            description: "Read one PostHog dashboard.",
            idLabel: "PostHog dashboard id.",
            label: "Get dashboard",
            path: (id) => `dashboards/${encodeURIComponent(id)}/`,
            requiredProviderScopes: ["dashboard:read"],
          }),
          getEnvironmentResourceCommand({
            commandKey: "dashboard.run_insights",
            commandPath: ["dashboard", "run_insights"],
            description: "Run the insights on one PostHog dashboard.",
            idLabel: "PostHog dashboard id.",
            label: "Run dashboard insights",
            path: (id) => `dashboards/${encodeURIComponent(id)}/run_insights/`,
            requiredProviderScopes: ["dashboard:read"],
          }),
        ],
        description: "Dashboard read commands.",
        groupKey: "dashboard",
        groupPath: ["dashboard"],
        label: "Dashboard",
      },
      {
        commands: [
          listProjectResourceCommand({
            commandKey: "feature_flag.list",
            commandPath: ["feature_flag", "list"],
            description: "List feature flags in a PostHog project.",
            label: "List feature flags",
            path: "feature_flags/",
            requiredProviderScopes: ["feature_flag:read"],
          }),
          getProjectResourceCommand({
            commandKey: "feature_flag.get",
            commandPath: ["feature_flag", "get"],
            description: "Read one PostHog feature flag.",
            idLabel: "PostHog feature flag id.",
            label: "Get feature flag",
            path: (id) => `feature_flags/${encodeURIComponent(id)}/`,
            requiredProviderScopes: ["feature_flag:read"],
          }),
          getProjectResourceCommand({
            commandKey: "feature_flag.activity",
            commandPath: ["feature_flag", "activity"],
            description: "Read activity for one PostHog feature flag.",
            idLabel: "PostHog feature flag id.",
            label: "Get feature flag activity",
            path: (id) => `feature_flags/${encodeURIComponent(id)}/activity/`,
            requiredProviderScopes: ["activity_log:read"],
          }),
        ],
        description: "Feature flag read commands.",
        groupKey: "feature_flag",
        groupPath: ["feature_flag"],
        label: "Feature Flag",
      },
      {
        commands: [
          listProjectResourceCommand({
            commandKey: "experiment.list",
            commandPath: ["experiment", "list"],
            description: "List experiments in a PostHog project.",
            label: "List experiments",
            path: "experiments/",
            requiredProviderScopes: ["experiment:read"],
          }),
          getProjectResourceCommand({
            commandKey: "experiment.get",
            commandPath: ["experiment", "get"],
            description: "Read one PostHog experiment.",
            idLabel: "PostHog experiment id.",
            label: "Get experiment",
            path: (id) => `experiments/${encodeURIComponent(id)}/`,
            requiredProviderScopes: ["experiment:read"],
          }),
        ],
        description: "Experiment read commands.",
        groupKey: "experiment",
        groupPath: ["experiment"],
        label: "Experiment",
      },
      {
        commands: [
          listProjectResourceCommand({
            commandKey: "annotation.list",
            commandPath: ["annotation", "list"],
            description: "List annotations in a PostHog project.",
            label: "List annotations",
            path: "annotations/",
            requiredProviderScopes: ["annotation:read"],
          }),
        ],
        description: "Annotation read commands.",
        groupKey: "annotation",
        groupPath: ["annotation"],
        label: "Annotation",
      },
      {
        commands: [
          listProjectResourceCommand({
            commandKey: "person.list",
            commandPath: ["person", "list"],
            description: "List persons in a PostHog project.",
            label: "List persons",
            path: "persons/",
            requiredProviderScopes: ["person:read"],
          }),
        ],
        description: "Sensitive person read commands.",
        groupKey: "person",
        groupPath: ["person"],
        label: "Person",
      },
      {
        commands: [
          listProjectResourceCommand({
            commandKey: "session_recording.list",
            commandPath: ["session_recording", "list"],
            description: "List session recordings in a PostHog project.",
            label: "List session recordings",
            path: "session_recordings/",
            requiredProviderScopes: ["session_recording:read"],
          }),
        ],
        description: "Session recording read commands.",
        groupKey: "session_recording",
        groupPath: ["session_recording"],
        label: "Session Recording",
      },
    ],
    rootCommands: [],
    toolDescription:
      "PostHog product analytics commands for projects, taxonomy, HogQL, insights, dashboards, feature flags, experiments, annotations, persons, and session recordings.",
    toolName: "posthog",
  },
  settingsPath: (orgSlug) =>
    `/${orgSlug}/settings/agent/integrations/posthog/status`,
  showInWorkspaceCatalog: true,
};

function requireOrganizationTarget(
  args: Record<string, unknown>,
  state: Record<string, unknown>,
) {
  const target = resolvePostHogTarget({
    arguments: args,
    state,
  });

  if (!target.organizationId) {
    throw new Error("PostHog command requires an organizationId.");
  }

  return {
    ...target,
    organizationId: target.organizationId,
  };
}

function requireProjectTarget(
  args: Record<string, unknown>,
  state: Record<string, unknown>,
) {
  const target = requireOrganizationTarget(args, state);

  if (!target.projectId) {
    throw new Error("PostHog command requires a projectId.");
  }

  return {
    ...target,
    projectId: target.projectId,
  };
}

function requireEnvironmentTarget(
  args: Record<string, unknown>,
  state: Record<string, unknown>,
) {
  const target = requireProjectTarget(args, state);

  if (!target.environmentId) {
    throw new Error("PostHog command requires an environmentId.");
  }

  return {
    ...target,
    environmentId: target.environmentId,
  };
}
