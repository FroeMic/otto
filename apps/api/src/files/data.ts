import { downloadRuntimePath } from "@otto/feature-runtime-core/runtime-files/download"
import { getRuntimeDirectorySnapshot } from "@otto/feature-runtime-core/runtime-files/snapshot"
import type {
  RuntimeDirectoryListingResponse,
  RuntimeDownloadKind,
  RuntimeDownloadResult,
} from "@otto/feature-runtime-core/runtime-files/types"
import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { tenantServers, tenants } from "@otto/feature-integrations-runtime/db/schema"
import { desc, eq } from "drizzle-orm"

import { execTenantRuntimeCommand, getTenantRuntimeConnection } from "../tenant-runtime/ssh"
import { getOrganizationWorkspaceBySlug } from "../workspace/data"

const WORKSPACE_ROOT = "/opt/openclaw/home/workspace"

type RuntimeWorkspaceRecord = {
  serverStatus: string | null
  tenantId: string
  tenantStatus: string
}

async function getLatestWorkspaceRuntime(input: {
  orgSlug: string
  userExternalId: string
}): Promise<RuntimeWorkspaceRecord | null> {
  const workspace = await getOrganizationWorkspaceBySlug(input)
  const db = getDb()
  const [tenant] = await db
    .select({
      serverStatus: tenantServers.status,
      tenantId: tenants.id,
      tenantStatus: tenants.status,
    })
    .from(tenants)
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(tenants.organizationId, workspace.id))
    .orderBy(desc(tenants.createdAt))
    .limit(1)

  return tenant ?? null
}

export async function getWorkspaceFilesDirectoryListing(input: {
  orgSlug: string
  userExternalId: string
}): Promise<RuntimeDirectoryListingResponse> {
  const runtime = await getLatestWorkspaceRuntime(input)

  if (
    !runtime ||
    runtime.tenantStatus !== "ready" ||
    runtime.serverStatus !== "ready"
  ) {
    return {
      snapshot: null,
      state: "pending_setup",
    }
  }

  const connection = await getTenantRuntimeConnection(
    runtime.tenantId,
    `GET /api/workspace/${input.orgSlug}/files`,
  )
  const snapshot = await getRuntimeDirectorySnapshot({
    execute: (command) => execTenantRuntimeCommand(connection, command),
    failureMessage: "Failed to read workspace files.",
    rootPath: WORKSPACE_ROOT,
  })

  return {
    snapshot,
    state: "ready",
  }
}

export async function downloadWorkspaceFile(input: {
  kind: RuntimeDownloadKind
  orgSlug: string
  relativePath: string
  userExternalId: string
}): Promise<RuntimeDownloadResult | null> {
  const runtime = await getLatestWorkspaceRuntime({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })

  if (
    !runtime ||
    runtime.tenantStatus !== "ready" ||
    runtime.serverStatus !== "ready"
  ) {
    return null
  }

  const connection = await getTenantRuntimeConnection(
    runtime.tenantId,
    `GET /api/workspace/${input.orgSlug}/files/download`,
  )

  return downloadRuntimePath({
    execute: (command) => execTenantRuntimeCommand(connection, command),
    kind: input.kind,
    relativePath: input.relativePath,
    rootPath: WORKSPACE_ROOT,
  })
}
