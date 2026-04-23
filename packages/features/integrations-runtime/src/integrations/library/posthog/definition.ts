import type {
  IntegrationCommandDefinition,
  IntegrationCommandExecute,
  IntegrationDefinition,
} from "../../framework"
import {
  buildPostHogEnvironmentPath,
  buildPostHogOrganizationPath,
  buildPostHogProjectPath,
  getPostHogAuth,
  prepareHogQlQuery,
  requestPostHog,
  resolvePostHogTarget,
} from "./client"

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
} as const

const LIMIT_ARGUMENT = {
  type: "integer",
  minimum: 1,
  maximum: 100,
  description: "Maximum number of results to return.",
} as const

const OFFSET_ARGUMENT = {
  type: "integer",
  minimum: 0,
  description: "Pagination offset.",
} as const

type IntegrationCommandExecuteInput = Parameters<IntegrationCommandExecute>[0]

function readCommand(input: {
  commandKey: string
  commandPath: string[]
  description: string
  exampleArguments?: Record<string, unknown>
  execute: IntegrationCommandExecute
  label: string
  properties?: Record<string, Record<string, unknown>>
  required?: string[]
  requiredProviderScopes: string[]
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
    exampleArguments: input.exampleArguments,
    execute: input.execute,
    inputMode: "json",
    label: input.label,
    requiredProviderScopes: input.requiredProviderScopes,
    resultMode: "json",
  }
}

function writeCommand(input: {
  commandKey: string
  commandPath: string[]
  description: string
  executeConfirmed: IntegrationCommandExecute
  label: string
  properties?: Record<string, Record<string, unknown>>
  required?: string[]
  requiredProviderScopes: string[]
  safety?: "destructive" | "normal"
  summary: string
}) {
  return {
    argumentsSchema: {
      additionalProperties: false,
      properties: {
        ...TARGET_ARGUMENTS,
        changeReason: {
          type: "string",
          minLength: 1,
          description: "Reason for this PostHog change.",
        },
        confirm: {
          type: "boolean",
          description:
            "Set true after reviewing the planned change to apply it.",
        },
        ...(input.properties ?? {}),
      },
      required: ["changeReason", ...(input.required ?? [])],
      type: "object",
    },
    commandKey: input.commandKey,
    commandPath: input.commandPath,
    description: input.description,
    effect: "write" as const,
    execute: async (executeInput: IntegrationCommandExecuteInput) => {
      if (executeInput.arguments.confirm !== true) {
        return {
          nextArguments: {
            ...executeInput.arguments,
            confirm: true,
          },
          planned: true,
          requiresConfirmation: true,
          summary: input.summary,
        }
      }

      return input.executeConfirmed(executeInput)
    },
    inputMode: "json" as const,
    label: input.label,
    requiredProviderScopes: input.requiredProviderScopes,
    resultMode: "json" as const,
    safety: input.safety ?? "normal",
  }
}

function listProjectResourceCommand(input: {
  commandKey: string
  commandPath: string[]
  description: string
  label: string
  path: string
  requiredProviderScopes: string[]
}) {
  return readCommand({
    ...input,
    execute: async ({ arguments: args, context }) => {
      const target = requireProjectTarget(args, getPostHogAuth(context).state)

      return requestPostHog(context, {
        path: buildPostHogProjectPath(target.projectId, input.path),
      })
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
  })
}

function getProjectResourceCommand(input: {
  commandKey: string
  commandPath: string[]
  description: string
  idLabel: string
  label: string
  path: (id: string) => string
  requiredProviderScopes: string[]
}) {
  return readCommand({
    ...input,
    execute: async ({ arguments: args, context }) => {
      const target = requireProjectTarget(args, getPostHogAuth(context).state)

      return requestPostHog(context, {
        path: buildPostHogProjectPath(
          target.projectId,
          input.path(String(args.id)),
        ),
      })
    },
    properties: {
      id: {
        type: "string",
        minLength: 1,
        description: input.idLabel,
      },
    },
    required: ["id"],
  })
}

function listEnvironmentResourceCommand(input: {
  commandKey: string
  commandPath: string[]
  description: string
  label: string
  path: string
  requiredProviderScopes: string[]
}) {
  return readCommand({
    ...input,
    execute: async ({ arguments: args, context }) => {
      const target = requireEnvironmentTarget(
        args,
        getPostHogAuth(context).state,
      )

      return requestPostHog(context, {
        path: buildPostHogEnvironmentPath(target.environmentId, input.path),
      })
    },
    properties: {
      limit: LIMIT_ARGUMENT,
      offset: OFFSET_ARGUMENT,
    },
  })
}

function getEnvironmentResourceCommand(input: {
  commandKey: string
  commandPath: string[]
  description: string
  idLabel: string
  label: string
  path: (id: string) => string
  requiredProviderScopes: string[]
}) {
  return readCommand({
    ...input,
    execute: async ({ arguments: args, context }) => {
      const target = requireEnvironmentTarget(
        args,
        getPostHogAuth(context).state,
      )

      return requestPostHog(context, {
        path: buildPostHogEnvironmentPath(
          target.environmentId,
          input.path(String(args.id)),
        ),
      })
    },
    properties: {
      id: {
        type: "string",
        minLength: 1,
        description: input.idLabel,
      },
    },
    required: ["id"],
  })
}

function createProjectResourceCommand(input: {
  commandKey: string
  commandPath: string[]
  description: string
  label: string
  path: string
  requiredProviderScopes: string[]
  summary: string
}) {
  return writeCommand({
    ...input,
    executeConfirmed: async ({ arguments: args, context }) => {
      const target = requireProjectTarget(args, getPostHogAuth(context).state)

      return requestPostHog(context, {
        body: args.payload,
        method: "POST",
        path: buildPostHogProjectPath(target.projectId, input.path),
      })
    },
    properties: {
      payload: {
        type: "object",
        description: "PostHog resource create payload.",
      },
    },
    required: ["payload"],
  })
}

function updateProjectResourceCommand(input: {
  commandKey: string
  commandPath: string[]
  description: string
  label: string
  path: (id: string) => string
  requiredProviderScopes: string[]
  summary: string
}) {
  return writeCommand({
    ...input,
    executeConfirmed: async ({ arguments: args, context }) => {
      const target = requireProjectTarget(args, getPostHogAuth(context).state)

      return requestPostHog(context, {
        body: args.payload,
        method: "PATCH",
        path: buildPostHogProjectPath(
          target.projectId,
          input.path(String(args.id)),
        ),
      })
    },
    properties: {
      id: {
        type: "string",
        minLength: 1,
        description: "PostHog resource id.",
      },
      payload: {
        type: "object",
        description: "PostHog resource update payload.",
      },
    },
    required: ["id", "payload"],
  })
}

function createEnvironmentResourceCommand(input: {
  commandKey: string
  commandPath: string[]
  description: string
  label: string
  path: string
  requiredProviderScopes: string[]
  summary: string
}) {
  return writeCommand({
    ...input,
    executeConfirmed: async ({ arguments: args, context }) => {
      const target = requireEnvironmentTarget(
        args,
        getPostHogAuth(context).state,
      )

      return requestPostHog(context, {
        body: args.payload,
        method: "POST",
        path: buildPostHogEnvironmentPath(target.environmentId, input.path),
      })
    },
    properties: {
      payload: {
        type: "object",
        description: "PostHog resource create payload.",
      },
    },
    required: ["payload"],
  })
}

function updateEnvironmentResourceCommand(input: {
  commandKey: string
  commandPath: string[]
  description: string
  label: string
  path: (id: string) => string
  requiredProviderScopes: string[]
  summary: string
}) {
  return writeCommand({
    ...input,
    executeConfirmed: async ({ arguments: args, context }) => {
      const target = requireEnvironmentTarget(
        args,
        getPostHogAuth(context).state,
      )

      return requestPostHog(context, {
        body: args.payload,
        method: "PATCH",
        path: buildPostHogEnvironmentPath(
          target.environmentId,
          input.path(String(args.id)),
        ),
      })
    },
    properties: {
      id: {
        type: "string",
        minLength: 1,
        description: "PostHog resource id.",
      },
      payload: {
        type: "object",
        description: "PostHog resource update payload.",
      },
    },
    required: ["id", "payload"],
  })
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
              )

              return requestPostHog(context, {
                path: buildPostHogOrganizationPath(
                  target.organizationId,
                  "projects/",
                ),
              }).then(shapePostHogProjectList)
            },
            label: "List projects",
            requiredProviderScopes: ["project:read"],
          }),
          readCommand({
            commandKey: "workspace.list_environments",
            commandPath: ["workspace", "list_environments"],
            description:
              "List PostHog environments for a configured or explicit project.",
            execute: async ({ arguments: args, context }) => {
              const target = requireProjectTarget(
                args,
                getPostHogAuth(context).state,
              )

              return requestPostHog(context, {
                path: buildPostHogProjectPath(
                  target.projectId,
                  "environments/",
                ),
              }).then((payload) =>
                shapePostHogEnvironmentList(payload, target.projectId),
              )
            },
            label: "List environments",
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
              )

              return requestPostHog(context, {
                path: buildPostHogOrganizationPath(
                  target.organizationId,
                  `projects/${encodeURIComponent(target.projectId)}/`,
                ),
              }).then(shapePostHogProject)
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
            exampleArguments: {
              maxRows: 14,
              query:
                "SELECT toDate(timestamp) AS day, count(DISTINCT person_id) AS daily_active_users FROM events WHERE timestamp >= now() - INTERVAL 7 DAY AND person_id IS NOT NULL GROUP BY day ORDER BY day ASC",
              targetKey: "production",
            },
            execute: async ({ arguments: args, context }) => {
              const target = requireEnvironmentTarget(
                args,
                getPostHogAuth(context).state,
              )
              const prepared = prepareHogQlQuery(
                String(args.query),
                typeof args.maxRows === "number" ? args.maxRows : 100,
              )

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
              })
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
          createEnvironmentResourceCommand({
            commandKey: "insight.create",
            commandPath: ["insight", "create"],
            description: "Create a PostHog insight after confirmation.",
            label: "Create insight",
            path: "insights/",
            requiredProviderScopes: ["insight:write"],
            summary: "Create PostHog insight.",
          }),
          updateEnvironmentResourceCommand({
            commandKey: "insight.update",
            commandPath: ["insight", "update"],
            description: "Update a PostHog insight after confirmation.",
            label: "Update insight",
            path: (id) => `insights/${encodeURIComponent(id)}/`,
            requiredProviderScopes: ["insight:write"],
            summary: "Update PostHog insight.",
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
          createProjectResourceCommand({
            commandKey: "feature_flag.create",
            commandPath: ["feature_flag", "create"],
            description: "Create a PostHog feature flag after confirmation.",
            label: "Create feature flag",
            path: "feature_flags/",
            requiredProviderScopes: ["feature_flag:write"],
            summary: "Create PostHog feature flag.",
          }),
          updateProjectResourceCommand({
            commandKey: "feature_flag.update",
            commandPath: ["feature_flag", "update"],
            description: "Update a PostHog feature flag after confirmation.",
            label: "Update feature flag",
            path: (id) => `feature_flags/${encodeURIComponent(id)}/`,
            requiredProviderScopes: ["feature_flag:write"],
            summary: "Update PostHog feature flag.",
          }),
          writeCommand({
            commandKey: "feature_flag.archive",
            commandPath: ["feature_flag", "archive"],
            description:
              "Archive a PostHog feature flag by marking it deleted after confirmation.",
            executeConfirmed: async ({ arguments: args, context }) => {
              const target = requireProjectTarget(
                args,
                getPostHogAuth(context).state,
              )

              return requestPostHog(context, {
                body: {
                  deleted: true,
                },
                method: "PATCH",
                path: buildPostHogProjectPath(
                  target.projectId,
                  `feature_flags/${encodeURIComponent(String(args.id))}/`,
                ),
              })
            },
            label: "Archive feature flag",
            properties: {
              id: {
                type: "string",
                minLength: 1,
                description: "PostHog feature flag id.",
              },
            },
            required: ["id"],
            requiredProviderScopes: ["feature_flag:write"],
            safety: "destructive",
            summary: "Archive PostHog feature flag.",
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
          createProjectResourceCommand({
            commandKey: "experiment.create",
            commandPath: ["experiment", "create"],
            description: "Create a PostHog experiment after confirmation.",
            label: "Create experiment",
            path: "experiments/",
            requiredProviderScopes: ["experiment:write"],
            summary: "Create PostHog experiment.",
          }),
          updateProjectResourceCommand({
            commandKey: "experiment.update",
            commandPath: ["experiment", "update"],
            description: "Update a PostHog experiment after confirmation.",
            label: "Update experiment",
            path: (id) => `experiments/${encodeURIComponent(id)}/`,
            requiredProviderScopes: ["experiment:write"],
            summary: "Update PostHog experiment.",
          }),
          writeCommand({
            commandKey: "experiment.archive",
            commandPath: ["experiment", "archive"],
            description: "Archive a PostHog experiment after confirmation.",
            executeConfirmed: async ({ arguments: args, context }) => {
              const target = requireProjectTarget(
                args,
                getPostHogAuth(context).state,
              )

              return requestPostHog(context, {
                body: {},
                method: "POST",
                path: buildPostHogProjectPath(
                  target.projectId,
                  `experiments/${encodeURIComponent(String(args.id))}/archive/`,
                ),
              })
            },
            label: "Archive experiment",
            properties: {
              id: {
                type: "string",
                minLength: 1,
                description: "PostHog experiment id.",
              },
            },
            required: ["id"],
            requiredProviderScopes: ["experiment:write"],
            safety: "destructive",
            summary: "Archive PostHog experiment.",
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
          createProjectResourceCommand({
            commandKey: "annotation.create",
            commandPath: ["annotation", "create"],
            description: "Create a PostHog annotation after confirmation.",
            label: "Create annotation",
            path: "annotations/",
            requiredProviderScopes: ["annotation:write"],
            summary: "Create PostHog annotation.",
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
  setup: {
    credential: {
      helpUrlTemplate: "{host}/settings/user-api-keys",
      label: "Personal API key",
      placeholder: "phx_...",
    },
    discovery: {
      actionLabel: "Test and discover workspace",
      defaultResourceSelectionMode: "first",
      resourceSelectionLabel: "PostHog project environments Otto can use",
      supportsMultipleResources: true,
    },
    host: {
      defaultValue: "https://us.posthog.com",
      helpText:
        "Use https://us.posthog.com for US Cloud, https://eu.posthog.com for EU Cloud, or your self-hosted PostHog origin.",
      label: "PostHog host",
      placeholder: "https://us.posthog.com",
    },
    mode: "api_key",
  },
  settingsPath: (orgSlug) =>
    `/${orgSlug}/settings/agent/integrations/posthog/status`,
  showInWorkspaceCatalog: true,
}

function shapePostHogProjectList(payload: unknown) {
  const page = normalizePostHogListPayload(payload)

  return {
    count: page.count,
    next: page.next,
    previous: page.previous,
    results: page.results.map(shapePostHogProject).filter(Boolean),
  }
}

function shapePostHogProject(payload: unknown) {
  if (!isRecord(payload)) {
    return null
  }

  return {
    completedSnippetOnboarding: getBoolean(
      payload,
      "completed_snippet_onboarding",
    ),
    id: getValueString(payload, "id"),
    ingestedEvent: getBoolean(payload, "ingested_event"),
    name: getValueString(payload, "name"),
    organizationId: getValueString(payload, "organization"),
    timezone: getValueString(payload, "timezone"),
    uuid: getValueString(payload, "uuid"),
  }
}

function shapePostHogEnvironmentList(payload: unknown, projectId: string) {
  const page = normalizePostHogListPayload(payload)

  return {
    count: page.count,
    next: page.next,
    previous: page.previous,
    projectId,
    results: page.results.map(shapePostHogEnvironment).filter(Boolean),
  }
}

function shapePostHogEnvironment(payload: unknown) {
  if (!isRecord(payload)) {
    return null
  }

  return {
    id: getValueString(payload, "id"),
    name: getValueString(payload, "name") ?? getValueString(payload, "label"),
    projectId:
      getValueString(payload, "project_id") ??
      getValueString(payload, "project"),
    uuid: getValueString(payload, "uuid"),
  }
}

function normalizePostHogListPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      next: null,
      previous: null,
      results: payload.filter(isRecord),
    }
  }

  if (isRecord(payload)) {
    const results = Array.isArray(payload.results)
      ? payload.results.filter(isRecord)
      : []

    return {
      count: typeof payload.count === "number" ? payload.count : results.length,
      next: payload.next ?? null,
      previous: payload.previous ?? null,
      results,
    }
  }

  return {
    count: 0,
    next: null,
    previous: null,
    results: [],
  }
}

function getValueString(record: Record<string, unknown>, key: string) {
  const value = record[key]

  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return null
}

function getBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key]

  return typeof value === "boolean" ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function requireOrganizationTarget(
  args: Record<string, unknown>,
  state: Record<string, unknown>,
) {
  const target = resolvePostHogTarget({
    arguments: args,
    state,
  })

  if (!target.organizationId) {
    throw new Error("PostHog command requires an organizationId.")
  }

  return {
    ...target,
    organizationId: target.organizationId,
  }
}

function requireProjectTarget(
  args: Record<string, unknown>,
  state: Record<string, unknown>,
) {
  const target = requireOrganizationTarget(args, state)

  if (!target.projectId) {
    throw new Error("PostHog command requires a projectId.")
  }

  return {
    ...target,
    projectId: target.projectId,
  }
}

function requireEnvironmentTarget(
  args: Record<string, unknown>,
  state: Record<string, unknown>,
) {
  const target = requireProjectTarget(args, state)

  if (!target.environmentId) {
    throw new Error(
      "PostHog command requires an environmentId. Re-run PostHog discovery in your workspace and select a project environment.",
    )
  }

  return {
    ...target,
    environmentId: target.environmentId,
  }
}
