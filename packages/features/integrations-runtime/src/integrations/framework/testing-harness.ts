import { listIntegrationCommands } from "./capabilities"
import { getIntegrationDefinition } from "./registry"
import { isPlatformManagedIntegration } from "./status"
import type { IntegrationDefinition } from "./types"

export type IntegrationTestType =
  | "agent_flow"
  | "internal"
  | "third_party_live"
  | "third_party_mock"
  | "ui"

export type IntegrationTestCoverageRecord = {
  key: string
  notes?: string
  status: "fail" | "pass"
  testType: IntegrationTestType
}

export type IntegrationTestingChecklistItem = {
  id: string
  owner: "integration_author" | "platform" | "qa"
  rationale: string
  required: boolean
  testType: IntegrationTestType
  title: string
}

export type IntegrationTestingChecklist = {
  generatedAt: string
  integrationKey: string
  items: IntegrationTestingChecklistItem[]
}

export type IntegrationTestingHarnessScore = {
  failedRequiredChecks: string[]
  optionalPassCount: number
  optionalTotal: number
  requiredPassCount: number
  requiredTotal: number
}

export type IntegrationTestingHarnessResult = {
  checklist: IntegrationTestingChecklist
  failures: string[]
  passed: boolean
  score: IntegrationTestingHarnessScore
}

function stableNowIso() {
  return new Date().toISOString()
}

function buildChecklistFromDefinition(
  definition: IntegrationDefinition & {
    runtimeSurface: NonNullable<IntegrationDefinition["runtimeSurface"]>
  },
): IntegrationTestingChecklist {
  const commandCount = listIntegrationCommands({
    definition,
  }).length
  const hasOauth = Boolean(definition.oauth)
  const hasApiKeyAuth = definition.auth?.kind === "api_key"
  const hasSettings = Boolean(definition.settings)
  const hasIngress = Boolean(definition.ingress)
  const platformManaged = isPlatformManagedIntegration(definition)

  const items: IntegrationTestingChecklistItem[] = [
    {
      id: "third-party-mock-contracts",
      owner: "integration_author",
      rationale:
        "Provider contracts need deterministic fixtures so command output shape and error mapping stay stable in CI.",
      required: true,
      testType: "third_party_mock",
      title: "Provider mock contract coverage exists for integration commands",
    },
    {
      id: "internal-framework-coverage",
      owner: "integration_author",
      rationale:
        "Registry, discovery, and command/schema response behavior must remain deterministic for runtime tools.",
      required: true,
      testType: "internal",
      title:
        "Internal framework coverage validates registry and runtime response behavior",
    },
    {
      id: "agent-flow-discover-inspect-execute",
      owner: "integration_author",
      rationale:
        "Agent reliability depends on proving discover -> inspect -> execute using the metatool workflow.",
      required: true,
      testType: "agent_flow",
      title:
        "Agent flow harness covers find_integration_commands to execute_integration_command",
    },
    {
      id: "third-party-live-smoke",
      owner: "qa",
      rationale:
        "A real provider smoke catches auth drift, rate-limit behavior, and API changes not seen in mocks.",
      required: false,
      testType: "third_party_live",
      title: "Live provider smoke passes in sandbox environment",
    },
  ]

  if (!platformManaged) {
    items.push({
      id: "ui-connect-disconnect-flow",
      owner: "qa",
      rationale:
        "Workspace-managed integrations require a stable user-managed lifecycle path for connect/disconnect recovery.",
      required: true,
      testType: "ui",
      title: "UI connect/disconnect smoke is automated",
    })
  }

  if (hasSettings) {
    if (platformManaged) {
      items.push({
        id: "agent-settings-readonly-get",
        owner: "integration_author",
        rationale:
          "Platform-managed settings should still expose a deterministic read path for agent guidance.",
        required: true,
        testType: "agent_flow",
        title:
          "Agent settings flow covers configure_integration action=get for read-only settings",
      })
    } else {
      items.push({
        id: "agent-settings-validate-apply",
        owner: "integration_author",
        rationale:
          "Agent-managed configuration must prove get/validate/apply and stale-version handling.",
        required: true,
        testType: "agent_flow",
        title:
          "Agent settings flow covers configure_integration get/validate/apply",
      })
    }
  }

  if (hasIngress) {
    items.push({
      id: "ingress-routing-and-diagnostics",
      owner: "platform",
      rationale:
        "Inbound integrations require routing, signature, and delivery diagnostics coverage.",
      required: true,
      testType: "internal",
      title: "Ingress routing and diagnostics paths are covered",
    })
  }

  if (hasOauth) {
    items.push({
      id: "oauth-connect-reconnect-needs-attention",
      owner: "platform",
      rationale:
        "OAuth integrations must prove connect, reconnect, and attention-state behavior end to end.",
      required: true,
      testType: "internal",
      title: "OAuth connect/reconnect/needs-attention transitions are covered",
    })
  }

  if (hasApiKeyAuth) {
    items.push({
      id: "api-key-scope-validation",
      owner: "integration_author",
      rationale:
        "API key integrations must enforce required scopes before command execution.",
      required: true,
      testType: "internal",
      title: "API key scope validation is covered",
    })
  }

  if (commandCount > 20) {
    items.push({
      id: "command-catalog-sampling-live",
      owner: "qa",
      rationale:
        "Large command catalogs should sample at least one command per major command group against live provider APIs.",
      required: false,
      testType: "third_party_live",
      title: "Live smoke samples representative commands from each command group",
    })
  }

  return {
    generatedAt: stableNowIso(),
    integrationKey: definition.key,
    items,
  }
}

function getCoverageStatusByKey(records: IntegrationTestCoverageRecord[]) {
  const statusByKey = new Map<string, "fail" | "pass">()

  for (const record of records) {
    if (record.status === "pass") {
      statusByKey.set(record.key, "pass")
      continue
    }

    if (!statusByKey.has(record.key)) {
      statusByKey.set(record.key, "fail")
    }
  }

  return statusByKey
}

export function buildIntegrationTestingChecklist(input: {
  integrationKey: string
}) {
  const integrationKey = input.integrationKey.trim().toLowerCase()
  const definition = getIntegrationDefinition(integrationKey)

  if (!definition?.runtimeSurface) {
    throw new Error(
      `Managed integration ${input.integrationKey} is not registered or does not expose a runtime surface.`,
    )
  }

  return buildChecklistFromDefinition(definition)
}

export function evaluateIntegrationTestingReadiness(input: {
  checklist: IntegrationTestingChecklist
  coverageRecords: IntegrationTestCoverageRecord[]
}): IntegrationTestingHarnessResult {
  const statusByKey = getCoverageStatusByKey(input.coverageRecords)
  const failures: string[] = []
  const failedRequiredChecks: string[] = []

  let requiredTotal = 0
  let requiredPassCount = 0
  let optionalTotal = 0
  let optionalPassCount = 0

  for (const item of input.checklist.items) {
    const status = statusByKey.get(item.id) ?? "fail"

    if (item.required) {
      requiredTotal += 1
      if (status === "pass") {
        requiredPassCount += 1
      } else {
        failedRequiredChecks.push(item.id)
        failures.push(
          `[${item.testType}] Missing required check ${item.id}: ${item.title}`,
        )
      }
      continue
    }

    optionalTotal += 1
    if (status === "pass") {
      optionalPassCount += 1
    }
  }

  return {
    checklist: input.checklist,
    failures,
    passed: failedRequiredChecks.length === 0,
    score: {
      failedRequiredChecks,
      optionalPassCount,
      optionalTotal,
      requiredPassCount,
      requiredTotal,
    },
  }
}

export function buildAndEvaluateIntegrationTestingReadiness(input: {
  coverageRecords: IntegrationTestCoverageRecord[]
  integrationKey: string
}): IntegrationTestingHarnessResult {
  const checklist = buildIntegrationTestingChecklist({
    integrationKey: input.integrationKey,
  })

  return evaluateIntegrationTestingReadiness({
    checklist,
    coverageRecords: input.coverageRecords,
  })
}
