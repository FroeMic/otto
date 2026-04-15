import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  creditLedgerEntries,
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
  getWorkspaceOnboardingHoldingState,
  isWorkspaceOnboardingReadyForProvisioning,
  workspaceOnboardingAnswerSchema,
  workspaceOnboardingRunSummarySchema,
  workspaceOnboardingRunStatusSchema,
  type WorkspaceOnboardingRunSummary,
  type WorkspaceOnboardingSaveRequest,
  workspaceOnboardingSaveRequestSchema,
  workspaceOnboardingStepKeySchema,
  workspaceOnboardingWaitlistDecisionSchema,
} from "../../../../packages/features/workspace-onboarding/src/index"
import type { WorkspaceSummary } from "@otto/feature-workspace-core"
import { WorkOS } from "@workos-inc/node"
import { and, desc, eq } from "drizzle-orm"

import {
  getApiEnv,
  hasWorkOsConfig,
} from "../env"
import { buildInitialWorkspaceCreditGrantInput } from "../billing/data"
import { CREDIT_LEDGER_ENTRY_TYPES } from "../billing/credit-pricing"
import { JOB_TYPES } from "../jobs/types"
import {
  generateUniqueWorkspaceSlug,
  getDashboardOrganizations,
  reconcileWorkspaceMembershipProjectionForUser,
  renameOrganization,
  syncUserFromSession,
  updateOrganizationSlug,
} from "../workspace/data"

type PostAuthUser = {
  email: string
  id: string
}

type WorkspaceOnboardingAccessRow = {
  externalOrganizationId: string
  isOrganizationReady: boolean
  organizationId: string
  organizationName: string
  organizationSlug: string
  userId: string
}

export class WorkspaceOnboardingConflictError extends Error {
  code = "workspace_onboarding_conflict" as const

  constructor(message: string) {
    super(message)
    this.name = "WorkspaceOnboardingConflictError"
  }
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

  const [firstPart] = cleaned
    .split(" ")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)

  return firstPart?.trim()
    ? `${firstPart}'s Workspace`
    : "Workspace"
}

function generateWorkspaceSlugSeed() {
  return `w-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`
}

async function ensureInitialWorkspaceCreditsInTransaction(input: {
  tenantId: string
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0]
}) {
  const grantInput = buildInitialWorkspaceCreditGrantInput({
    tenantId: input.tenantId,
  })

  await input.tx
    .insert(creditLedgerEntries)
    .values({
      billableUnits: 0,
      creditsDeltaMilli: grantInput.creditsDeltaMilli,
      description: grantInput.description,
      entryType: CREDIT_LEDGER_ENTRY_TYPES.manualGrant,
      sourceId: grantInput.sourceId,
      sourceType: grantInput.sourceType,
      tenantId: input.tenantId,
    })
    .onConflictDoNothing({
      target: [
        creditLedgerEntries.sourceType,
        creditLedgerEntries.sourceId,
        creditLedgerEntries.entryType,
      ],
    })
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
      await dependencies.createWorkspaceOnboardingRun({
        organizationId: workspace.id,
        starterPrompt: intakeSession.prompt,
        userId: localUser.id,
      })
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
    workspaceName: generateWorkspaceSlugSeed(),
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
      currentStepKey: "business_type",
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

export function getWorkspaceOnboardingSummaryLookupSlug(input: {
  currentOrgSlug: string
  request: WorkspaceOnboardingSaveRequest
}) {
  return input.request.action === "save-workspace-identity"
    ? input.request.workspaceSlug
    : input.currentOrgSlug
}

async function getWorkspaceOnboardingAccessRow(input: {
  orgSlug: string
  userExternalId: string
}) {
  const db = getDb()
  const [row] = await db
    .select({
      externalOrganizationId: organizations.externalId,
      isOrganizationReady: organizations.isReady,
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      userId: users.id,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(
      and(
        eq(organizations.slug, input.orgSlug),
        eq(users.externalId, input.userExternalId),
        eq(memberships.status, "active"),
      ),
    )
    .limit(1)

  if (!row) {
    throw new Error("Organization not found")
  }

  return row satisfies WorkspaceOnboardingAccessRow
}

async function getOrCreateWorkspaceOnboardingRunForAccess(
  access: WorkspaceOnboardingAccessRow,
) {
  const db = getDb()
  const [run] = await db
    .select({
      answersJson: workspaceOnboardingRuns.answersJson,
      completedAt: workspaceOnboardingRuns.completedAt,
      currentStepKey: workspaceOnboardingRuns.currentStepKey,
      id: workspaceOnboardingRuns.id,
      initialProvisioningJobId: workspaceOnboardingRuns.initialProvisioningJobId,
      initialTenantId: workspaceOnboardingRuns.initialTenantId,
      provisioningStartedAt: workspaceOnboardingRuns.provisioningStartedAt,
      starterPrompt: workspaceOnboardingRuns.starterPrompt,
      starterPromptConsumedAt: workspaceOnboardingRuns.starterPromptConsumedAt,
      status: workspaceOnboardingRuns.status,
      waitlistDecision: workspaceOnboardingRuns.waitlistDecision,
      waitlistReason: workspaceOnboardingRuns.waitlistReason,
    })
    .from(workspaceOnboardingRuns)
    .where(
      and(
        eq(workspaceOnboardingRuns.organizationId, access.organizationId),
        eq(workspaceOnboardingRuns.userId, access.userId),
      ),
    )
    .limit(1)

  if (run || access.isOrganizationReady) {
    return run ?? null
  }

  await createWorkspaceOnboardingRun({
    organizationId: access.organizationId,
    starterPrompt: "",
    userId: access.userId,
  })

  const [createdRun] = await db
    .select({
      answersJson: workspaceOnboardingRuns.answersJson,
      completedAt: workspaceOnboardingRuns.completedAt,
      currentStepKey: workspaceOnboardingRuns.currentStepKey,
      id: workspaceOnboardingRuns.id,
      initialProvisioningJobId: workspaceOnboardingRuns.initialProvisioningJobId,
      initialTenantId: workspaceOnboardingRuns.initialTenantId,
      provisioningStartedAt: workspaceOnboardingRuns.provisioningStartedAt,
      starterPrompt: workspaceOnboardingRuns.starterPrompt,
      starterPromptConsumedAt: workspaceOnboardingRuns.starterPromptConsumedAt,
      status: workspaceOnboardingRuns.status,
      waitlistDecision: workspaceOnboardingRuns.waitlistDecision,
      waitlistReason: workspaceOnboardingRuns.waitlistReason,
    })
    .from(workspaceOnboardingRuns)
    .where(
      and(
        eq(workspaceOnboardingRuns.organizationId, access.organizationId),
        eq(workspaceOnboardingRuns.userId, access.userId),
      ),
    )
    .limit(1)

  return createdRun ?? null
}

function buildWorkspaceOnboardingRunSummary(input: {
  access: WorkspaceOnboardingAccessRow
  run: Awaited<ReturnType<typeof getOrCreateWorkspaceOnboardingRunForAccess>>
}): WorkspaceOnboardingRunSummary {
  if (!input.run) {
    return workspaceOnboardingRunSummarySchema.parse({
      answers: {},
      currentStepKey: null,
      holdingState: "ready",
      initialProvisioningJobId: null,
      initialTenantId: null,
      isOrganizationReady: input.access.isOrganizationReady,
      organizationId: input.access.organizationId,
      organizationSlug: input.access.organizationSlug,
      provisioningStartedAt: null,
      starterPrompt: null,
      starterPromptConsumedAt: null,
      status: "ready",
      waitlistDecision: "accepted",
      waitlistReason: null,
    })
  }

  const status = workspaceOnboardingRunStatusSchema.parse(input.run.status)
  const waitlistDecision = workspaceOnboardingWaitlistDecisionSchema.parse(
    input.run.waitlistDecision,
  )

  return workspaceOnboardingRunSummarySchema.parse({
    answers: workspaceOnboardingAnswerSchema.parse(input.run.answersJson),
    currentStepKey: input.run.currentStepKey
      ? workspaceOnboardingStepKeySchema.parse(input.run.currentStepKey)
      : null,
    holdingState: getWorkspaceOnboardingHoldingState({
      isOrganizationReady: input.access.isOrganizationReady,
      provisioningStartedAt: input.run.provisioningStartedAt,
      status,
      waitlistDecision,
    }),
    initialProvisioningJobId: input.run.initialProvisioningJobId,
    initialTenantId: input.run.initialTenantId,
    isOrganizationReady: input.access.isOrganizationReady,
    organizationId: input.access.organizationId,
    organizationSlug: input.access.organizationSlug,
    provisioningStartedAt: input.run.provisioningStartedAt?.toISOString() ?? null,
    starterPrompt: input.run.starterPrompt,
    starterPromptConsumedAt:
      input.run.starterPromptConsumedAt?.toISOString() ?? null,
    status,
    waitlistDecision,
    waitlistReason: input.run.waitlistReason,
  })
}

export async function getWorkspaceOnboardingRunSummary(input: {
  orgSlug: string
  userExternalId: string
}) {
  const access = await getWorkspaceOnboardingAccessRow(input)
  const run = await getOrCreateWorkspaceOnboardingRunForAccess(access)

  return buildWorkspaceOnboardingRunSummary({
    access,
    run,
  })
}

export async function saveWorkspaceOnboardingRun(input: {
  body: WorkspaceOnboardingSaveRequest
  orgSlug: string
  userExternalId: string
}) {
  const request = workspaceOnboardingSaveRequestSchema.parse(input.body)
  const access = await getWorkspaceOnboardingAccessRow({
    orgSlug: input.orgSlug,
    userExternalId: input.userExternalId,
  })
  const run = await getOrCreateWorkspaceOnboardingRunForAccess(access)

  if (!run) {
    throw new Error("Workspace onboarding run not found")
  }

  const answers = workspaceOnboardingAnswerSchema.parse(run.answersJson)
  const now = new Date()
  let nextAnswers = answers
  let nextCurrentStepKey: string | null = run.currentStepKey
  let nextStatus = run.status

  switch (request.action) {
    case "save-workspace-identity": {
      if (access.organizationName !== request.workspaceName) {
        await renameOrganization({
          externalOrganizationId: access.externalOrganizationId,
          name: request.workspaceName,
          organizationId: access.organizationId,
        })
      }

      const slugResult = await updateOrganizationSlug({
        organizationId: access.organizationId,
        slug: request.workspaceSlug,
      })

      if (slugResult === "slug_taken") {
        throw new WorkspaceOnboardingConflictError(
          "This workspace URL is already taken.",
        )
      }

      nextAnswers = {
        ...answers,
        workspace_name: request.workspaceName,
        workspace_slug: request.workspaceSlug,
      }
      nextCurrentStepKey = "business_type"
      break
    }
    case "save-business-type": {
      nextAnswers = {
        ...answers,
        business_type: request.businessType,
      }
      nextCurrentStepKey = "team_setup"
      break
    }
    case "save-team-setup": {
      nextAnswers = {
        ...answers,
        team_size: request.teamSize,
      }
      nextCurrentStepKey = null
      nextStatus = "accepted_pending_provision"
      break
    }
  }

  const db = getDb()
  await db
    .update(workspaceOnboardingRuns)
    .set({
      answersJson: nextAnswers,
      completedAt: nextCurrentStepKey === null ? now : run.completedAt,
      currentStepKey: nextCurrentStepKey,
      status: nextStatus,
      updatedAt: now,
    })
    .where(eq(workspaceOnboardingRuns.id, run.id))

  await maybeStartInitialProvisioningForWorkspaceOnboarding({
    organizationId: access.organizationId,
    runId: run.id,
    userExternalId: input.userExternalId,
  })

  return getWorkspaceOnboardingRunSummary({
    orgSlug: getWorkspaceOnboardingSummaryLookupSlug({
      currentOrgSlug: input.orgSlug,
      request,
    }),
    userExternalId: input.userExternalId,
  })
}

export async function consumeWorkspaceOnboardingStarterPrompt(input: {
  orgSlug: string
  userExternalId: string
}) {
  const access = await getWorkspaceOnboardingAccessRow(input)
  const db = getDb()

  await db
    .update(workspaceOnboardingRuns)
    .set({
      starterPromptConsumedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceOnboardingRuns.organizationId, access.organizationId),
        eq(workspaceOnboardingRuns.userId, access.userId),
      ),
    )
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
      await ensureInitialWorkspaceCreditsInTransaction({
        tenantId: existingTenant.id,
        tx,
      })

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

    await ensureInitialWorkspaceCreditsInTransaction({
      tenantId: tenant.id,
      tx,
    })

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
