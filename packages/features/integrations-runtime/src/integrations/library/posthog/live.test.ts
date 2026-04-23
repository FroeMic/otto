import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { collectCommands } from "../../framework"
import { posthogIntegrationDefinition } from "./definition"
import { type PostHogIntegrationState, PostHogApiError } from "./client"
import { discoverPostHogIntegrationSetup } from "./setup"

const liveApiKey = process.env.POSTHOG_LIVE_TEST_API_KEY?.trim()
const liveHost =
  process.env.POSTHOG_LIVE_TEST_HOST?.trim() || "https://us.posthog.com"
const describeLive = liveApiKey ? describe : describe.skip
const LIVE_TEST_TIMEOUT_MS = 30_000

describeLive("PostHog live integration contract", () => {
  it(
    "discovers the live account and does not expose token material",
    async () => {
      const discovery = await discoverLiveSetup()

      assert.equal(discovery.ok, true)
      assert.ok(
        discovery.resources.length > 0,
        "expected at least one PostHog project or environment resource",
      )
      assert.doesNotMatch(JSON.stringify(discovery), /ph[ctx]_[A-Za-z0-9_]+/)
    },
    LIVE_TEST_TIMEOUT_MS,
  )

  it(
    "lists projects through the runtime command surface",
    async () => {
      const discovery = await discoverLiveSetup()
      const context = buildLiveCommandContext(discovery.statePreview)
      const command = getPostHogCommand("workspace.list_projects")
      const result = await command.execute({
        arguments: {},
        context,
      })
      const results = getResultsArray(result)

      assert.ok(results.length > 0, "expected at least one PostHog project")
      assert.doesNotMatch(
        JSON.stringify(result),
        /api_token|phc_[A-Za-z0-9_]+/,
      )
    },
    LIVE_TEST_TIMEOUT_MS,
  )

  it(
    "returns configured target state through the runtime command surface",
    async () => {
      const discovery = await discoverLiveSetup()
      const state = discovery.statePreview as PostHogIntegrationState
      const context = buildLiveCommandContext(state)
      const command = getPostHogCommand("workspace.get_configured_targets")
      const result = (await command.execute({
        arguments: {},
        context,
      })) as PostHogIntegrationState

      assert.equal(result.host, state.host)
      assert.equal(result.defaultTargetKey, state.defaultTargetKey)
      assert.ok(result.targets.length > 0, "expected configured PostHog targets")

      if (state.targets.some((entry) => entry.environmentId)) {
        assert.ok(
          result.targets.some((entry) => entry.environmentId),
          "expected configured target state to include environmentId",
        )
      }
    },
    LIVE_TEST_TIMEOUT_MS,
  )

  it(
    "runs the live read command battery without provider errors",
    async () => {
      const discovery = await discoverLiveSetup()
      const state = discovery.statePreview as PostHogIntegrationState
      const context = buildLiveCommandContext(state)
      const commandResults: Array<{ commandKey: string; result: unknown }> = []

      for (const commandCase of buildLiveReadCommandCases(state)) {
        try {
          const result = await getPostHogCommand(commandCase.commandKey).execute(
            {
              arguments: commandCase.arguments,
              context,
            },
          )
          commandResults.push({
            commandKey: commandCase.commandKey,
            result,
          })
        } catch (error) {
          assert.fail(
            `${commandCase.commandKey} failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      }

      assert.equal(commandResults.length, buildLiveReadCommandCases(state).length)
    },
    LIVE_TEST_TIMEOUT_MS,
  )

  it(
    "runs a bounded HogQL smoke query only when a concrete environment is configured",
    async () => {
      const discovery = await discoverLiveSetup()
      const state = discovery.statePreview as PostHogIntegrationState
      const context = buildLiveCommandContext(state)
      const command = getPostHogCommand("query.hogql")
      const target = state.targets.find((entry) => entry.environmentId)

      if (!target?.environmentId) {
        await assert.rejects(
          () =>
            command.execute({
              arguments: {
                maxRows: 1,
                query: "SELECT 1 AS ok",
              },
              context,
            }),
          /requires an environmentId/,
        )
        return
      }

      const result = await command.execute({
        arguments: {
          maxRows: 1,
          query: "SELECT 1 AS ok",
          targetKey: target.key,
        },
        context,
      })

      assert.ok(result)
    },
    LIVE_TEST_TIMEOUT_MS,
  )
})

async function discoverLiveSetup() {
  assert.ok(
    liveApiKey,
    "POSTHOG_LIVE_TEST_API_KEY is required for PostHog live tests.",
  )

  return discoverPostHogIntegrationSetup({
    apiKey: liveApiKey,
    host: liveHost,
  })
}

function getPostHogCommand(commandKey: string) {
  const command = collectCommands(
    posthogIntegrationDefinition.runtimeSurface!,
  ).find((entry) => entry.commandKey === commandKey)

  assert.ok(command, `expected PostHog command ${commandKey} to be registered`)

  return command
}

function buildLiveCommandContext(statePreview: Record<string, unknown>) {
  assert.ok(liveApiKey)

  return {
    auth: {
      accessToken: undefined as never,
      apiKey: liveApiKey,
      credentialId: "live-test-credential",
      declaredScopes: [
        "action:read",
        "annotation:read",
        "dashboard:read",
        "event_definition:read",
        "experiment:read",
        "feature_flag:read",
        "insight:read",
        "person:read",
        "property_definition:read",
        "project:read",
        "query:read",
        "session_recording:read",
      ],
      externalAccountLabel: "PostHog live test",
      kind: "api_key" as const,
      metadata: {},
      providerKey: "posthog",
      state: statePreview,
      stateVersion: 1,
      status: "connected",
      tenantIntegrationId: "live-test-tenant-integration",
    },
    tenantIntegrationId: "live-test-tenant-integration",
  }
}

function buildLiveReadCommandCases(state: PostHogIntegrationState) {
  const hasEnvironment = state.targets.some((entry) => entry.environmentId)
  const cases: Array<{
    arguments: Record<string, unknown>
    commandKey: string
  }> = [
    {
      arguments: {},
      commandKey: "workspace.get_configured_targets",
    },
    {
      arguments: {},
      commandKey: "workspace.list_projects",
    },
    {
      arguments: {},
      commandKey: "workspace.get_project",
    },
    {
      arguments: { limit: 1 },
      commandKey: "taxonomy.event_definition.list",
    },
    {
      arguments: { limit: 1 },
      commandKey: "taxonomy.property_definition.list",
    },
    {
      arguments: { limit: 1 },
      commandKey: "taxonomy.action.list",
    },
    {
      arguments: { limit: 1 },
      commandKey: "feature_flag.list",
    },
    {
      arguments: { limit: 1 },
      commandKey: "experiment.list",
    },
    {
      arguments: { limit: 1 },
      commandKey: "annotation.list",
    },
    {
      arguments: { limit: 1 },
      commandKey: "person.list",
    },
    {
      arguments: { limit: 1 },
      commandKey: "session_recording.list",
    },
  ]

  if (hasEnvironment) {
    cases.push(
      {
        arguments: {
          maxRows: 1,
          query: "SELECT 1 AS ok",
        },
        commandKey: "query.hogql",
      },
      {
        arguments: { limit: 1 },
        commandKey: "insight.list",
      },
      {
        arguments: { limit: 1 },
        commandKey: "dashboard.list",
      },
    )
  }

  return cases
}

function getResultsArray(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "results" in value &&
    Array.isArray(value.results)
  ) {
    return value.results
  }

  return []
}
