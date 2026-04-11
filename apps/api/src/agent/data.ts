import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { tenants } from "@otto/feature-integrations-runtime/db/schema"
import { desc, eq } from "drizzle-orm"

import {
  getLatestTenantManagedConfig,
  updateTenantManagedFileSharedContentForTenant,
} from "../runtime/managed-config/data"
import type { ManagedBootstrapFilePath } from "../runtime/managed-config/definition"
import { getOrganizationWorkspaceBySlug } from "../workspace/data"
import type {
  AgentInstruction,
  AgentInstructionUpdateResponse,
  AgentPersonalizationDetailResponse,
  AgentPersonalizationOverviewResponse,
} from "./contracts"
import {
  getAgentInstructionTabBySlug,
  getAgentInstructionTabs,
  getDefaultAgentInstructionTab,
} from "./instruction-tabs"

async function getLatestTenantForWorkspace(input: {
  orgSlug: string
  userExternalId: string
}) {
  const workspace = await getOrganizationWorkspaceBySlug(input)
  const db = getDb()
  const [tenant] = await db
    .select({
      id: tenants.id,
    })
    .from(tenants)
    .where(eq(tenants.organizationId, workspace.id))
    .orderBy(desc(tenants.createdAt))
    .limit(1)

  return tenant ?? null
}

function mapInstruction(input: {
  description: string
  filePath: ManagedBootstrapFilePath
  sharedContent: string
  slug: string
  systemContent: string
  version: number
}): AgentInstruction {
  const tab = getAgentInstructionTabBySlug(input.slug)

  if (!tab) {
    throw new Error(`Unsupported agent instruction tab: ${input.slug}`)
  }

  return {
    description: input.description,
    filePath: input.filePath,
    label: tab.label,
    sharedContent: input.sharedContent,
    slug: tab.slug,
    systemContent: input.systemContent,
    version: input.version,
  }
}

export async function getAgentPersonalizationOverview(input: {
  orgSlug: string
  userExternalId: string
}): Promise<AgentPersonalizationOverviewResponse> {
  const tenant = await getLatestTenantForWorkspace(input)

  return {
    defaultInstructionTab: getDefaultAgentInstructionTab().slug,
    state: tenant ? "ready" : "pending_setup",
    tabs: getAgentInstructionTabs(),
  }
}

export async function getAgentPersonalizationDetail(input: {
  instructionTab: string
  orgSlug: string
  userExternalId: string
}): Promise<AgentPersonalizationDetailResponse | null> {
  const selectedTab = getAgentInstructionTabBySlug(input.instructionTab)

  if (!selectedTab) {
    return null
  }

  const tenant = await getLatestTenantForWorkspace({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })

  if (!tenant) {
    return {
      defaultInstructionTab: getDefaultAgentInstructionTab().slug,
      instruction: null,
      selectedTab,
      state: "pending_setup",
      tabs: getAgentInstructionTabs(),
    }
  }

  const managedConfig = await getLatestTenantManagedConfig(tenant.id)
  const selectedFile = managedConfig.files.find(
    (file) => file.path === selectedTab.filePath,
  )

  if (!selectedFile) {
    return null
  }

  return {
    defaultInstructionTab: getDefaultAgentInstructionTab().slug,
    instruction: mapInstruction({
      description: selectedFile.description,
      filePath: selectedFile.path,
      sharedContent: selectedFile.sharedContent,
      slug: selectedTab.slug,
      systemContent: selectedFile.systemContent,
      version: managedConfig.version,
    }),
    selectedTab,
    state: "ready",
    tabs: getAgentInstructionTabs(),
  }
}

export async function updateAgentPersonalizationInstruction(input: {
  expectedVersion?: number
  instructionTab: string
  orgSlug: string
  sharedContent: string
  userExternalId: string
}): Promise<AgentInstructionUpdateResponse | null> {
  const selectedTab = getAgentInstructionTabBySlug(input.instructionTab)

  if (!selectedTab) {
    return null
  }

  const tenant = await getLatestTenantForWorkspace({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })

  if (!tenant) {
    return null
  }

  const updateResult = await updateTenantManagedFileSharedContentForTenant({
    createdByExternalId: input.userExternalId,
    createdByType: "user",
    expectedVersion: input.expectedVersion,
    filePath: selectedTab.filePath,
    sharedContent: input.sharedContent,
    summary: `Updated ${selectedTab.label}`,
    tenantId: tenant.id,
  })

  const managedConfig = await getLatestTenantManagedConfig(tenant.id)
  const selectedFile = managedConfig.files.find(
    (file) => file.path === selectedTab.filePath,
  )

  if (!selectedFile) {
    return null
  }

  return {
    applyQueued: updateResult.applyQueued,
    changed: updateResult.changed,
    currentVersion: updateResult.currentVersion,
    desiredStateVersion: updateResult.desiredStateVersion,
    instruction: mapInstruction({
      description: selectedFile.description,
      filePath: selectedFile.path,
      sharedContent: selectedFile.sharedContent,
      slug: selectedTab.slug,
      systemContent: selectedFile.systemContent,
      version: managedConfig.version,
    }),
    managedConfigVersion: updateResult.managedConfigVersion,
  }
}
