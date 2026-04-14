import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  jobEvents,
  jobRuns,
  memberships,
  organizations,
  publicIntakeSessions,
  tenantDesiredStates,
  tenantServers,
  tenants,
  users,
  workspaceOnboardingRuns,
} from "@otto/feature-integrations-runtime/db/schema"
import {
  isWorkspaceOnboardingReadyForProvisioning,
  workspaceOnboardingAnswerSchema,
  workspaceOnboardingRunStatusSchema,
  workspaceOnboardingWaitlistDecisionSchema,
} from "../../../../packages/features/workspace-onboarding/src/index"
import type { WorkspaceSummary } from "@otto/feature-workspace-core"
import { WorkOS } from "@workos-inc/node"
import { and, desc, eq } from "drizzle-orm"

import {
  getApiEnv,
  hasWorkOsConfig,
} from "../env"
import { JOB_TYPES } from "../jobs/types"
import {
  generateUniqueWorkspaceSlug,
  getDashboardOrganizations,
  reconcileWorkspaceMembershipProjectionForUser,
  syncUserFromSession,
} from "../workspace/data"

type PostAuthUser = {
  email: string
  id: string
}

export type PostAuthWorkspaceOnboardingDependencies = {
  createWorkspaceForUser: (input: {
    user: PostAuthUser
    workspaceName: string
  }) => Promise<{
    organizationId: string
    organizationSlug: string
  }>
  createWorkspaceOnboardingRun: (input: {
    organizationId: string
    starterPrompt: string
    userId: string
  }) => Promise<void>
  getDashboardOrganizations: (
    userExternalId: string,
  ) => Promise<WorkspaceSummary[]>
  getPublicIntakeSessionById: (publicIntakeSessionId: string) => Promise<{
    id: string
    prompt: string
  } | null>
  markPublicIntakeSessionConverted: (input: {
    organizationId: string
    publicIntakeSessionId: string
    userId: string
  }) => Promise<void>
  syncUserFromSession: (user: PostAuthUser) => Promise<{
    id: string
  }>
}

function createDefaultPostAuthWorkspaceOnboardingDependencies(): PostAuthWorkspaceOnboardingDependencies {
  return {
    createWorkspaceForUser,
    createWorkspaceOnboardingRun,
    getDashboardOrganizations,
    getPublicIntakeSessionById,
    markPublicIntakeSessionConverted,
    syncUserFromSession,
  }
}

function deriveWorkspaceNameFromUser(user: PostAuthUser) {
  const emailLocalPart = user.email.split("@")[0]?.trim() ?? ""
  const cleaned = emailLocalPart
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")

  if (cleaned.length === 0) {
    return "Workspace"
  }

  return cleaned
    .split(" ")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

export async function getPostAuthRedirectPathForWorkspaceOnboarding(
  input: {
    defaultReturnTo: string
    intakeSessionId: string | null
    user: PostAuthUser
  },
  dependencies: PostAuthWorkspaceOnboardingDependencies = createDefaultPostAuthWorkspaceOnboardingDependencies(),
) {
  if (!input.intakeSessionId) {
    return input.defaultReturnTo
  }

  const intakeSession = await dependencies.getPublicIntakeSessionById(
    input.intakeSessionId,
  )

  if (!intakeSession) {
    return input.defaultReturnTo
  }

  const localUser = await dependencies.syncUserFromSession(input.user)
  const organizations = await dependencies.getDashboardOrganizations(
    input.user.id,
  )

  if (organizations.length > 0) {
    const workspace = organizations[0]

    if (workspace) {
      await dependencies.markPublicIntakeSessionConverted({
        organizationId: workspace.id,
        publicIntakeSessionId: intakeSession.id,
        userId: localUser.id,
      })

      return `/${workspace.slug}`
    }
  }

  const createdWorkspace = await dependencies.createWorkspaceForUser({
    user: input.user,
    workspaceName: deriveWorkspaceNameFromUser(input.user),
  })

  await dependencies.createWorkspaceOnboardingRun({
    organizationId: createdWorkspace.organizationId,
    starterPrompt: intakeSession.prompt,
    userId: localUser.id,
  })
  await dependencies.markPublicIntakeSessionConverted({
    organizationId: createdWorkspace.organizationId,
    publicIntakeSessionId: intakeSession.id,
    userId: localUser.id,
  })

  return `/${createdWorkspace.organizationSlug}/onboarding`
}

export async function getPublicIntakeSessionById(publicIntakeSessionId: string) {
  const db = getDb()
  const [session] = await db
    .select({
      id: publicIntakeSessions.id,
      prompt: publicIntakeSessions.prompt,
    })
    .from(publicIntakeSessions)
    .where(eq(publicIntakeSessions.id, publicIntakeSessionId))
    .limit(1)

  return session ?? null
}

export async function markPublicIntakeSessionConverted(input: {
  organizationId: string
  publicIntakeSessionId: string
  userId: string
}) {
  const db = getDb()

  await db
    .update(publicIntakeSessions)
    .set({
      convertedOrganizationId: input.organizationId,
      convertedUserId: input.userId,
      status: "converted",
      updatedAt: new Date(),
    })
    .where(eq(publicIntakeSessions.id, input.publicIntakeSessionId))
}

export async function createWorkspaceForUser(input: {
  user: PostAuthUser
  workspaceName: string
}) {
  const env = getApiEnv()

  if (!hasWorkOsConfig(env)) {
    throw new Error("WorkOS is not configured")
  }

  const workos = new WorkOS(env.WORKOS_API_KEY ?? "", {
    clientId: env.WORKOS_CLIENT_ID,
  })
  const createdOrganization = await workos.organizations.createOrganization({
    name: input.workspaceName,
  })
  const organizationSlug = await generateUniqueWorkspaceSlug({
    slugSuffixHint: createdOrganization.id,
    workspaceName: input.workspaceName,
  })
  const db = getDb()

  await db
    .insert(organizations)
    .values({
      externalId: createdOrganization.id,
      isReady: false,
      name: input.workspaceName,
      slug: organizationSlug,
    })
    .onConflictDoNothing({
      target: organizations.externalId,
    })

  await workos.userManagement.createOrganizationMembership({
    organizationId: createdOrganization.id,
    roleSlug: "admin",
    userId: input.user.id,
  })

  await reconcileWorkspaceMembershipProjectionForUser(input.user.id)

  const [organization] = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.externalId, createdOrganization.id))
    .limit(1)

  if (!organization) {
    throw new Error("Failed to create workspace organization projection")
  }

  return {
    organizationId: organization.id,
    organizationSlug: organization.slug,
  }
}

export async function createWorkspaceOnboardingRun(input: {
  organizationId: string
  starterPrompt: string
  userId: string
}) {
  const db = getDb()

  await db
    .insert(workspaceOnboardingRuns)
    .values({
      answersJson: {},
      currentStepKey: "workspace_identity",
      flowKey: "workspace_onboarding",
      flowVersion: 1,
      organizationId: input.organizationId,
      starterPrompt: input.starterPrompt,
      status: "collecting_answers",
      userId: input.userId,
      waitlistDecision: "accepted",
    })
    .onConflictDoUpdate({
      set: {
        starterPrompt: input.starterPrompt,
        updatedAt: new Date(),
      },
      target: [
        workspaceOnboardingRuns.userId,
        workspaceOnboardingRuns.organizationId,
      ],
    })
}

export async function maybeStartInitialProvisioningForWorkspaceOnboarding(input: {
  organizationId: string
  runId: string
  userExternalId: string
}) {
  const db = getDb()

  return db.transaction(async (tx) => {
    const [run] = await tx
      .select({
        answersJson: workspaceOnboardingRuns.answersJson,
        id: workspaceOnboardingRuns.id,
        initialTenantId: workspaceOnboardingRuns.initialTenantId,
        organizationId: workspaceOnboardingRuns.organizationId,
        provisioningStartedAt: workspaceOnboardingRuns.provisioningStartedAt,
        status: workspaceOnboardingRuns.status,
        waitlistDecision: workspaceOnboardingRuns.waitlistDecision,
      })
      .from(workspaceOnboardingRuns)
      .where(
        and(
          eq(workspaceOnboardingRuns.id, input.runId),
          eq(workspaceOnboardingRuns.organizationId, input.organizationId),
        ),
      )
      .limit(1)

    if (!run || run.initialTenantId || run.provisioningStartedAt) {
      return null
    }

    const answers = workspaceOnboardingAnswerSchema.parse(run.answersJson)
    const status = workspaceOnboardingRunStatusSchema.parse(run.status)
    const waitlistDecision = workspaceOnboardingWaitlistDecisionSchema.parse(
      run.waitlistDecision,
    )

    if (
      !isWorkspaceOnboardingReadyForProvisioning({
        answers,
        currentStepKey: null,
        initialTenantId: run.initialTenantId,
        provisioningStartedAt: run.provisioningStartedAt,
        status,
        waitlistDecision,
      })
    ) {
      return null
    }

    const [authorizedMembership] = await tx
      .select({
        organizationId: memberships.organizationId,
        userId: memberships.userId,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.organizationId, input.organizationId),
          eq(memberships.status, "active"),
          eq(users.externalId, input.userExternalId),
        ),
      )
      .limit(1)

    if (!authorizedMembership) {
      throw new Error("You do not have access to this organization")
    }

    const [existingTenant] = await tx
      .select({
        id: tenants.id,
      })
      .from(tenants)
      .where(eq(tenants.organizationId, input.organizationId))
      .limit(1)

    if (existingTenant) {
      await tx
        .update(workspaceOnboardingRuns)
        .set({
          initialTenantId: existingTenant.id,
          provisioningStartedAt: new Date(),
          status: "provisioning",
          updatedAt: new Date(),
        })
        .where(eq(workspaceOnboardingRuns.id, input.runId))

      return {
        jobId: null,
        tenantId: existingTenant.id,
      }
    }

    const [organization] = await tx
      .select({
        name: organizations.name,
      })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .limit(1)

    if (!organization) {
      throw new Error("Organization not found")
    }

    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: organization.name,
        organizationId: input.organizationId,
        status: "provisioning",
      })
      .returning({
        id: tenants.id,
      })

    if (!tenant) {
      throw new Error("Failed to create tenant")
    }

    await tx.insert(tenantServers).values({
      provider: "hetzner",
      sshUsername: "openclaw",
      status: "creating",
      tenantId: tenant.id,
    })

    await tx.insert(tenantDesiredStates).values({
      configJson: {},
      tenantId: tenant.id,
      version: 1,
    })

    const [job] = await tx
      .insert(jobRuns)
      .values({
        availableAt: new Date(),
        jobType: JOB_TYPES.provisionTenantServer,
        payloadJson: {
          step: "create_server",
          tenantId: tenant.id,
        },
        status: "queued",
        tenantId: tenant.id,
      })
      .returning({
        id: jobRuns.id,
      })

    if (!job) {
      throw new Error("Failed to queue initial provisioning job")
    }

    await tx.insert(jobEvents).values({
      dataJson: {
        jobType: JOB_TYPES.provisionTenantServer,
      },
      eventType: "queued",
      jobRunId: job.id,
      message: "Job queued for execution",
    })

    await tx
      .update(workspaceOnboardingRuns)
      .set({
        initialProvisioningJobId: job.id,
        initialTenantId: tenant.id,
        provisioningStartedAt: new Date(),
        status: "provisioning",
        updatedAt: new Date(),
      })
      .where(eq(workspaceOnboardingRuns.id, input.runId))

    return {
      jobId: job.id,
      tenantId: tenant.id,
    }
  })
}
