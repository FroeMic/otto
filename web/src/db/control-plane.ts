import { randomBytes } from "node:crypto";

import type { User } from "@workos-inc/node";
import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  integrationSecrets,
  jobEvents,
  jobRuns,
  memberships,
  messagingConversations,
  messagingWorkspaceMembers,
  messagingWorkspaces,
  organizations,
  slackInstallations,
  tenantApplyRuns,
  tenantDesiredStates,
  tenantIntegrations,
  tenantOnboardingSessions,
  tenantRuntimeSecrets,
  tenantServers,
  tenants,
  users,
  waitlistSignups,
} from "@/db/schema";
import {
  decryptControlPlaneSecret,
  encryptControlPlaneSecret,
} from "@/lib/crypto";
import { enqueueJob } from "@/lib/jobs/queue";
import { JOB_TYPES } from "@/lib/jobs/types";
import { getWorkOS } from "@/lib/workos";

const SLACK_PROVIDER_KEY = "slack";
const SLACK_BOT_TOKEN_SECRET_TYPE = "slack_bot_token";
const OPENCLAW_GATEWAY_TOKEN_SECRET_TYPE = "openclaw_gateway_token";

type OnboardingSessionSummary = {
  createdAt: Date;
  id: string;
  slackConnectedAt: Date | null;
  slackOauthError: string | null;
  slackOauthErrorAt: Date | null;
  slackTeamName: string | null;
  status: string;
  tenantName: string;
};

type SlackIntegrationSummary = {
  connectedAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  status: string;
  teamName: string | null;
};

type TenantApplyRunSummary = {
  desiredStateVersion: number;
  error: string | null;
  finishedAt: Date | null;
  startedAt: Date | null;
  status: string;
};

type MessagingDirectoryMemberInput = {
  avatarUrl: string | null;
  displayName: string | null;
  email: string | null;
  externalMemberId: string;
  fullName: string | null;
  isDeleted: boolean;
  memberType: string;
  profileJson: unknown;
  username: string | null;
};

type MessagingConversationInput = {
  conversationType: string;
  externalConversationId: string;
  isArchived: boolean;
  metadataJson: unknown;
  name: string | null;
  purpose: string | null;
  topic: string | null;
};

type DbTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

export type WaitlistSignupInput = {
  email: string;
  heardAboutOtto: string | null;
  name: string;
  usagePreference: "alone" | "team";
  useCase: string | null;
};

export type DashboardOrganization = {
  id: string;
  externalId: string;
  isReady: boolean;
  latestOnboardingSession: OnboardingSessionSummary | null;
  onboardingDraft: OnboardingSessionSummary | null;
  name: string;
  role: string;
  slackIntegration: SlackIntegrationSummary | null;
  slug: string;
  tenants: Array<{
    createdAt: Date;
    id: string;
    ipv4: string | null;
    latestJob: {
      attempt: number;
      error: string | null;
      events: Array<{
        createdAt: Date;
        eventType: string;
        message: string;
      }>;
      finishedAt: Date | null;
      id: string;
      startedAt: Date | null;
      status: string;
      step: string | null;
    } | null;
    name: string;
    latestApplyRun: {
      desiredStateVersion: number;
      error: string | null;
      finishedAt: Date | null;
      startedAt: Date | null;
      status: string;
    } | null;
    status: string;
    serverStatus: string | null;
  }>;
};

export async function syncUserFromSession(user: User) {
  const db = getDb();

  const [upsertedUser] = await db
    .insert(users)
    .values({
      externalId: user.id,
      email: user.email,
    })
    .onConflictDoUpdate({
      target: users.externalId,
      set: {
        email: user.email,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: users.id,
      externalId: users.externalId,
      email: users.email,
    });

  return upsertedUser;
}

export async function upsertWaitlistSignup(input: WaitlistSignupInput) {
  const db = getDb();

  try {
    const [signup] = await db
      .insert(waitlistSignups)
      .values({
        email: input.email,
        heardAboutOtto: input.heardAboutOtto,
        name: input.name,
        usagePreference: input.usagePreference,
        useCase: input.useCase,
      })
      .onConflictDoUpdate({
        target: waitlistSignups.email,
        set: {
          heardAboutOtto: input.heardAboutOtto,
          name: input.name,
          updatedAt: new Date(),
          usagePreference: input.usagePreference,
          useCase: input.useCase,
        },
      })
      .returning({
        email: waitlistSignups.email,
        id: waitlistSignups.id,
      });

    return signup;
  } catch (error) {
    console.error("[waitlist] db upsert failed", {
      email: input.email,
      error,
    });
    throw error;
  }
}

export async function getDashboardOrganizations(
  userExternalId: string,
): Promise<DashboardOrganization[]> {
  const db = getDb();

  const organizationRows = await db
    .select({
      organizationId: organizations.id,
      organizationExternalId: organizations.externalId,
      organizationIsReady: organizations.isReady,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(users.externalId, userExternalId));

  if (organizationRows.length === 0) {
    return [];
  }

  const organizationIds = organizationRows.map((row) => row.organizationId);

  const onboardingRows = await db
    .select({
      createdAt: tenantOnboardingSessions.createdAt,
      id: tenantOnboardingSessions.id,
      organizationId: tenantOnboardingSessions.organizationId,
      slackOauthError: tenantOnboardingSessions.slackOauthError,
      slackOauthErrorAt: tenantOnboardingSessions.slackOauthErrorAt,
      slackTeamName: tenantOnboardingSessions.slackTeamName,
      slackConnectedAt: tenantOnboardingSessions.slackConnectedAt,
      status: tenantOnboardingSessions.status,
      tenantId: tenantOnboardingSessions.tenantId,
      tenantName: tenantOnboardingSessions.tenantName,
      userId: tenantOnboardingSessions.userId,
    })
    .from(tenantOnboardingSessions)
    .innerJoin(users, eq(tenantOnboardingSessions.userId, users.id))
    .where(
      and(
        inArray(tenantOnboardingSessions.organizationId, organizationIds),
        eq(users.externalId, userExternalId),
      ),
    )
    .orderBy(desc(tenantOnboardingSessions.createdAt));

  const onboardingByOrganization = new Map<
    string,
    (typeof onboardingRows)[number]
  >();
  const latestOnboardingByOrganization = new Map<
    string,
    (typeof onboardingRows)[number]
  >();

  for (const onboarding of onboardingRows) {
    if (!latestOnboardingByOrganization.has(onboarding.organizationId)) {
      latestOnboardingByOrganization.set(onboarding.organizationId, onboarding);
    }

    if (onboarding.status === "completed") {
      continue;
    }

    if (!onboardingByOrganization.has(onboarding.organizationId)) {
      onboardingByOrganization.set(onboarding.organizationId, onboarding);
    }
  }

  const tenantRows = await db
    .select({
      createdAt: tenants.createdAt,
      id: tenants.id,
      ipv4: tenantServers.ipv4,
      organizationId: tenants.organizationId,
      name: tenants.name,
      status: tenants.status,
      serverStatus: tenantServers.status,
    })
    .from(tenants)
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(inArray(tenants.organizationId, organizationIds))
    .orderBy(desc(tenants.createdAt));

  const tenantIds = tenantRows.map((tenant) => tenant.id);
  const slackIntegrationRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            connectedAt: tenantIntegrations.connectedAt,
            lastError: tenantIntegrations.lastError,
            lastErrorAt: tenantIntegrations.lastErrorAt,
            status: tenantIntegrations.status,
            teamName: slackInstallations.slackTeamName,
            tenantId: tenantIntegrations.tenantId,
          })
          .from(tenantIntegrations)
          .leftJoin(
            slackInstallations,
            eq(slackInstallations.tenantIntegrationId, tenantIntegrations.id),
          )
          .where(
            and(
              inArray(tenantIntegrations.tenantId, tenantIds),
              eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
            ),
          );

  const slackIntegrationsByTenant = new Map<
    string,
    (typeof slackIntegrationRows)[number]
  >();

  for (const integration of slackIntegrationRows) {
    if (slackIntegrationsByTenant.has(integration.tenantId)) {
      continue;
    }

    slackIntegrationsByTenant.set(integration.tenantId, integration);
  }

  const latestJobRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            attempt: jobRuns.attempt,
            createdAt: jobRuns.createdAt,
            error: jobRuns.error,
            finishedAt: jobRuns.finishedAt,
            id: jobRuns.id,
            payloadJson: jobRuns.payloadJson,
            startedAt: jobRuns.startedAt,
            status: jobRuns.status,
            tenantId: jobRuns.tenantId,
          })
          .from(jobRuns)
          .where(inArray(jobRuns.tenantId, tenantIds))
          .orderBy(desc(jobRuns.createdAt));

  const latestJobsByTenant = new Map<string, (typeof latestJobRows)[number]>();

  for (const job of latestJobRows) {
    if (!job.tenantId || latestJobsByTenant.has(job.tenantId)) {
      continue;
    }

    latestJobsByTenant.set(job.tenantId, job);
  }

  const latestJobIds = Array.from(latestJobsByTenant.values()).map(
    (job) => job.id,
  );

  const jobEventRows =
    latestJobIds.length === 0
      ? []
      : await db
          .select({
            createdAt: jobEvents.createdAt,
            eventType: jobEvents.eventType,
            jobRunId: jobEvents.jobRunId,
            message: jobEvents.message,
          })
          .from(jobEvents)
          .where(inArray(jobEvents.jobRunId, latestJobIds))
          .orderBy(desc(jobEvents.createdAt));

  const jobEventsByJobRunId = new Map<
    string,
    Array<{
      createdAt: Date;
      eventType: string;
      message: string;
    }>
  >();

  for (const event of jobEventRows) {
    const existingEvents = jobEventsByJobRunId.get(event.jobRunId) ?? [];
    existingEvents.push({
      createdAt: event.createdAt,
      eventType: event.eventType,
      message: event.message,
    });
    jobEventsByJobRunId.set(event.jobRunId, existingEvents);
  }

  const latestApplyRunRows =
    tenantIds.length === 0
      ? []
      : await db
          .select({
            desiredStateVersion: tenantApplyRuns.desiredStateVersion,
            error: tenantApplyRuns.error,
            finishedAt: tenantApplyRuns.finishedAt,
            startedAt: tenantApplyRuns.startedAt,
            status: tenantApplyRuns.status,
            tenantId: tenantApplyRuns.tenantId,
          })
          .from(tenantApplyRuns)
          .where(inArray(tenantApplyRuns.tenantId, tenantIds))
          .orderBy(desc(tenantApplyRuns.createdAt));

  const latestApplyRunsByTenant = new Map<
    string,
    (typeof latestApplyRunRows)[number]
  >();

  for (const applyRun of latestApplyRunRows) {
    if (latestApplyRunsByTenant.has(applyRun.tenantId)) {
      continue;
    }

    latestApplyRunsByTenant.set(applyRun.tenantId, applyRun);
  }

  return organizationRows.map((organization) => {
    const organizationTenants = tenantRows
      .filter((tenant) => tenant.organizationId === organization.organizationId)
      .map((tenant) => ({
        createdAt: tenant.createdAt,
        id: tenant.id,
        ipv4: tenant.ipv4,
        latestApplyRun: buildTenantApplyRunSummary(
          latestApplyRunsByTenant.get(tenant.id) ?? null,
        ),
        latestJob: buildLatestJobSummary(
          latestJobsByTenant.get(tenant.id) ?? null,
          jobEventsByJobRunId,
        ),
        name: tenant.name,
        status: tenant.status,
        serverStatus: tenant.serverStatus,
      }));
    const primaryTenant = organizationTenants[0] ?? null;

    return {
      id: organization.organizationId,
      externalId: organization.organizationExternalId,
      isReady: organization.organizationIsReady,
      latestOnboardingSession: buildOnboardingDraftSummary(
        latestOnboardingByOrganization.get(organization.organizationId) ?? null,
      ),
      onboardingDraft: buildOnboardingDraftSummary(
        onboardingByOrganization.get(organization.organizationId) ?? null,
      ),
      name: organization.organizationName,
      role: organization.role,
      slackIntegration: buildSlackIntegrationSummary(
        primaryTenant
          ? (slackIntegrationsByTenant.get(primaryTenant.id) ?? null)
          : null,
      ),
      slug: organization.organizationSlug,
      tenants: organizationTenants,
    };
  });
}

function buildOnboardingDraftSummary(
  onboarding: OnboardingSessionSummary | null,
) {
  if (!onboarding) {
    return null;
  }

  return {
    createdAt: onboarding.createdAt,
    id: onboarding.id,
    slackOauthError: onboarding.slackOauthError,
    slackOauthErrorAt: onboarding.slackOauthErrorAt,
    slackTeamName: onboarding.slackTeamName,
    slackConnectedAt: onboarding.slackConnectedAt,
    status: onboarding.status,
    tenantName: onboarding.tenantName,
  };
}

function buildSlackIntegrationSummary(
  integration: SlackIntegrationSummary | null,
) {
  if (!integration) {
    return null;
  }

  return {
    connectedAt: integration.connectedAt,
    lastError: integration.lastError,
    lastErrorAt: integration.lastErrorAt,
    status: integration.status,
    teamName: integration.teamName,
  };
}

function buildTenantApplyRunSummary(applyRun: TenantApplyRunSummary | null) {
  if (!applyRun) {
    return null;
  }

  return {
    desiredStateVersion: applyRun.desiredStateVersion,
    error: applyRun.error,
    finishedAt: applyRun.finishedAt,
    startedAt: applyRun.startedAt,
    status: applyRun.status,
  };
}

function buildLatestJobSummary(
  job: {
    attempt: number;
    error: string | null;
    finishedAt: Date | null;
    id: string;
    payloadJson: unknown;
    startedAt: Date | null;
    status: string;
  } | null,
  jobEventsByJobRunId: Map<
    string,
    Array<{
      createdAt: Date;
      eventType: string;
      message: string;
    }>
  >,
) {
  if (!job) {
    return null;
  }

  const payload = parseRecord(job.payloadJson);
  const step = typeof payload.step === "string" ? payload.step : null;
  const events = (jobEventsByJobRunId.get(job.id) ?? []).slice(0, 6).reverse();

  return {
    attempt: job.attempt,
    error: job.error,
    events,
    finishedAt: job.finishedAt,
    id: job.id,
    startedAt: job.startedAt,
    status: job.status,
    step,
  };
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export async function createWorkspaceOnboardingDraft(input: {
  workspaceName: string;
  workspaceSlug: string;
  user: User;
}) {
  const workos = getWorkOS();
  const db = getDb();
  const syncedUser = await syncUserFromSession(input.user);
  const normalizedSlug = normalizeOrganizationSlug(input.workspaceSlug);

  if (!normalizedSlug) {
    throw new Error("Workspace slug is required");
  }

  const [existingOrganization] = await db
    .select({
      id: organizations.id,
    })
    .from(organizations)
    .where(eq(organizations.slug, normalizedSlug))
    .limit(1);

  if (existingOrganization) {
    throw new Error("Workspace slug is already in use");
  }

  const organization = await workos.organizations.createOrganization({
    name: input.workspaceName,
  });

  await workos.userManagement.createOrganizationMembership({
    organizationId: organization.id,
    userId: input.user.id,
  });

  await db.transaction(async (tx) => {
    const [createdOrganization] = await tx
      .insert(organizations)
      .values({
        externalId: organization.id,
        isReady: false,
        name: organization.name,
        slug: normalizedSlug,
      })
      .returning({
        id: organizations.id,
        name: organizations.name,
      });

    await tx.insert(memberships).values({
      organizationId: createdOrganization.id,
      userId: syncedUser.id,
      role: "admin",
    });

    await tx.insert(tenantOnboardingSessions).values({
      organizationId: createdOrganization.id,
      status: "draft",
      tenantName: deriveTenantName(createdOrganization.name),
      userId: syncedUser.id,
    });

    return {
      organizationId: createdOrganization.id,
    };
  });
}

export async function createOnboardingDraftForOrganization(input: {
  organizationId: string;
  userExternalId: string;
}) {
  const db = getDb();

  const authorizedMembership = await db
    .select({
      organizationId: memberships.organizationId,
      organizationIsReady: organizations.isReady,
      organizationName: organizations.name,
      userId: users.id,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(
      and(
        eq(memberships.organizationId, input.organizationId),
        eq(users.externalId, input.userExternalId),
      ),
    );

  if (authorizedMembership.length === 0) {
    throw new Error("You do not have access to this organization");
  }

  if (!authorizedMembership[0].organizationIsReady) {
    throw new Error("Organization is not ready for setup yet");
  }

  const existingDraft = await db
    .select({
      id: tenantOnboardingSessions.id,
    })
    .from(tenantOnboardingSessions)
    .where(
      and(
        eq(tenantOnboardingSessions.organizationId, input.organizationId),
        eq(tenantOnboardingSessions.userId, authorizedMembership[0].userId),
      ),
    )
    .orderBy(desc(tenantOnboardingSessions.createdAt))
    .limit(1);

  if (existingDraft[0]) {
    await db
      .update(tenantOnboardingSessions)
      .set({
        slackOauthError: null,
        slackOauthErrorAt: null,
        status: "draft",
        tenantName: deriveTenantName(authorizedMembership[0].organizationName),
        updatedAt: new Date(),
      })
      .where(eq(tenantOnboardingSessions.id, existingDraft[0].id));

    return;
  }

  await db.insert(tenantOnboardingSessions).values({
    organizationId: input.organizationId,
    status: "draft",
    tenantName: deriveTenantName(authorizedMembership[0].organizationName),
    userId: authorizedMembership[0].userId,
  });
}

export async function getOrganizationWorkspaceBySlug(input: {
  orgSlug: string;
  userExternalId: string;
}) {
  const organizations = await getDashboardOrganizations(input.userExternalId);
  const organization = organizations.find(
    (item) => item.slug === input.orgSlug,
  );

  if (!organization) {
    throw new Error("Organization not found");
  }

  return organization;
}

export async function getOnboardingDraftForUser(input: {
  onboardingSessionId: string;
  userExternalId: string;
}) {
  const db = getDb();

  const [session] = await db
    .select({
      id: tenantOnboardingSessions.id,
      organizationId: tenantOnboardingSessions.organizationId,
      organizationIsReady: organizations.isReady,
      organizationSlug: organizations.slug,
      slackConnectedAt: tenantOnboardingSessions.slackConnectedAt,
      slackOauthError: tenantOnboardingSessions.slackOauthError,
      slackTeamId: tenantOnboardingSessions.slackTeamId,
      serverStatus: tenantServers.status,
      status: tenantOnboardingSessions.status,
      tenantId: tenantOnboardingSessions.tenantId,
      tenantName: tenantOnboardingSessions.tenantName,
      tenantStatus: tenants.status,
      userId: users.id,
    })
    .from(tenantOnboardingSessions)
    .innerJoin(users, eq(tenantOnboardingSessions.userId, users.id))
    .innerJoin(
      organizations,
      eq(tenantOnboardingSessions.organizationId, organizations.id),
    )
    .leftJoin(tenants, eq(tenantOnboardingSessions.tenantId, tenants.id))
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(
      and(
        eq(tenantOnboardingSessions.id, input.onboardingSessionId),
        eq(users.externalId, input.userExternalId),
      ),
    )
    .limit(1);

  if (!session) {
    throw new Error("Onboarding draft not found");
  }

  return session;
}

export async function completeSlackOnboardingAndProvision(input: {
  botToken: string;
  installerUserId: string | null;
  onboardingSessionId: string;
  scopeCsv: string;
  slackBotUserId: string | null;
  slackTeamId: string;
  slackTeamName: string | null;
  userExternalId: string;
}) {
  const db = getDb();
  const authorizedSession = await getOnboardingDraftForUser({
    onboardingSessionId: input.onboardingSessionId,
    userExternalId: input.userExternalId,
  });

  if (!authorizedSession.organizationIsReady) {
    throw new Error("Organization is not ready for Slack or provisioning yet");
  }

  if (authorizedSession.tenantId) {
    const tenantId = authorizedSession.tenantId;
    const now = new Date();
    let tenantIntegrationId = "";
    let desiredStateVersion = 0;
    const shouldEnqueueApply =
      authorizedSession.tenantStatus === "ready" &&
      authorizedSession.serverStatus === "ready";

    await db.transaction(async (tx) => {
      await tx
        .update(tenantOnboardingSessions)
        .set({
          slackBotTokenCiphertext: encryptControlPlaneSecret(input.botToken),
          slackBotUserId: input.slackBotUserId,
          slackConnectedAt: now,
          slackInstalledAt: now,
          slackOauthError: null,
          slackOauthErrorAt: null,
          slackScopeCsv: input.scopeCsv,
          slackTeamId: input.slackTeamId,
          slackTeamName: input.slackTeamName,
          updatedAt: now,
        })
        .where(eq(tenantOnboardingSessions.id, input.onboardingSessionId));

      tenantIntegrationId = await upsertSlackIntegrationForTenant(tx, {
        botToken: input.botToken,
        installerUserId: input.installerUserId,
        now,
        scopeCsv: input.scopeCsv,
        slackBotUserId: input.slackBotUserId,
        slackTeamId: input.slackTeamId,
        slackTeamName: input.slackTeamName,
        tenantId,
      });

      desiredStateVersion = (
        await createNextDesiredStateVersion(tx, {
          tenantId,
        })
      ).version;

      if (shouldEnqueueApply) {
        await markSlackIntegrationPendingApply(tx, {
          now,
          tenantId,
        });
      }
    });

    if (shouldEnqueueApply) {
      await enqueueTenantConfigApply({
        desiredStateVersion,
        tenantId,
      });
    }

    return {
      organizationSlug: authorizedSession.organizationSlug,
      applyQueued: shouldEnqueueApply,
      tenantIntegrationId,
      tenantId,
    };
  }

  const now = new Date();

  const createdTenant = await db.transaction(async (tx) => {
    const finalTenantName = deriveTenantName(
      input.slackTeamName || authorizedSession.tenantName,
    );

    await tx
      .update(tenantOnboardingSessions)
      .set({
        slackBotTokenCiphertext: encryptControlPlaneSecret(input.botToken),
        slackBotUserId: input.slackBotUserId,
        slackConnectedAt: now,
        slackInstalledAt: now,
        slackOauthError: null,
        slackOauthErrorAt: null,
        slackScopeCsv: input.scopeCsv,
        slackTeamId: input.slackTeamId,
        slackTeamName: input.slackTeamName,
        status: "slack_connected",
        tenantName: finalTenantName,
        updatedAt: now,
      })
      .where(eq(tenantOnboardingSessions.id, input.onboardingSessionId));

    const [tenant] = await tx
      .insert(tenants)
      .values({
        organizationId: authorizedSession.organizationId,
        name: finalTenantName,
        status: "provisioning",
      })
      .returning({
        id: tenants.id,
      });

    const tenantIntegrationId = await upsertSlackIntegrationForTenant(tx, {
      botToken: input.botToken,
      installerUserId: input.installerUserId,
      now,
      scopeCsv: input.scopeCsv,
      slackBotUserId: input.slackBotUserId,
      slackTeamId: input.slackTeamId,
      slackTeamName: input.slackTeamName,
      tenantId: tenant.id,
    });

    await tx.insert(tenantServers).values({
      tenantId: tenant.id,
      provider: "hetzner",
      sshUsername: "openclaw",
      status: "creating",
    });

    await createNextDesiredStateVersion(tx, {
      tenantId: tenant.id,
    });

    await tx
      .update(tenantOnboardingSessions)
      .set({
        completedAt: now,
        status: "completed",
        tenantId: tenant.id,
        updatedAt: now,
      })
      .where(eq(tenantOnboardingSessions.id, input.onboardingSessionId));

    return {
      id: tenant.id,
      tenantIntegrationId,
    };
  });

  await enqueueJob({
    jobType: JOB_TYPES.provisionTenantServer,
    payload: {
      tenantId: createdTenant.id,
      step: "create_server",
    },
  });

  return {
    applyQueued: false,
    organizationSlug: authorizedSession.organizationSlug,
    tenantId: createdTenant.id,
    tenantIntegrationId: createdTenant.tenantIntegrationId,
  };
}

export async function recordSlackOauthFailure(input: {
  error: string;
  onboardingSessionId: string;
  userExternalId: string;
}) {
  const db = getDb();
  const authorizedSession = await getOnboardingDraftForUser({
    onboardingSessionId: input.onboardingSessionId,
    userExternalId: input.userExternalId,
  });
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(tenantOnboardingSessions)
      .set({
        slackOauthError: input.error,
        slackOauthErrorAt: now,
        updatedAt: now,
      })
      .where(eq(tenantOnboardingSessions.id, input.onboardingSessionId));

    if (!authorizedSession.tenantId) {
      return;
    }

    await recordSlackIntegrationError(tx, {
      error: input.error,
      now,
      tenantId: authorizedSession.tenantId,
    });
  });
}

export async function syncMessagingDirectoryForTenantIntegration(input: {
  conversations: MessagingConversationInput[];
  externalWorkspaceId: string;
  tenantIntegrationId: string;
  workspaceDisplayName: string | null;
  members: MessagingDirectoryMemberInput[];
}) {
  const db = getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    const messagingWorkspaceId = await upsertMessagingWorkspace(tx, {
      externalWorkspaceId: input.externalWorkspaceId,
      now,
      tenantIntegrationId: input.tenantIntegrationId,
      workspaceDisplayName: input.workspaceDisplayName,
    });

    for (const member of input.members) {
      if (!member.externalMemberId) {
        continue;
      }

      await tx
        .insert(messagingWorkspaceMembers)
        .values({
          avatarUrl: member.avatarUrl,
          displayName: member.displayName,
          email: member.email,
          externalMemberId: member.externalMemberId,
          fullName: member.fullName,
          isDeleted: member.isDeleted,
          lastSyncedAt: now,
          memberType: member.memberType,
          messagingWorkspaceId,
          profileJson: normalizeJsonValue(member.profileJson),
          username: member.username,
        })
        .onConflictDoUpdate({
          target: [
            messagingWorkspaceMembers.messagingWorkspaceId,
            messagingWorkspaceMembers.externalMemberId,
          ],
          set: {
            avatarUrl: member.avatarUrl,
            displayName: member.displayName,
            email: member.email,
            fullName: member.fullName,
            isDeleted: member.isDeleted,
            lastSyncedAt: now,
            memberType: member.memberType,
            profileJson: normalizeJsonValue(member.profileJson),
            updatedAt: now,
            username: member.username,
          },
        });
    }

    for (const conversation of input.conversations) {
      if (!conversation.externalConversationId) {
        continue;
      }

      await tx
        .insert(messagingConversations)
        .values({
          conversationType: conversation.conversationType,
          externalConversationId: conversation.externalConversationId,
          isArchived: conversation.isArchived,
          lastSyncedAt: now,
          messagingWorkspaceId,
          metadataJson: normalizeJsonValue(conversation.metadataJson),
          name: conversation.name,
          purpose: conversation.purpose,
          topic: conversation.topic,
        })
        .onConflictDoUpdate({
          target: [
            messagingConversations.messagingWorkspaceId,
            messagingConversations.externalConversationId,
          ],
          set: {
            conversationType: conversation.conversationType,
            isArchived: conversation.isArchived,
            lastSyncedAt: now,
            metadataJson: normalizeJsonValue(conversation.metadataJson),
            name: conversation.name,
            purpose: conversation.purpose,
            topic: conversation.topic,
            updatedAt: now,
          },
        });
    }

    await tx
      .update(messagingWorkspaces)
      .set({
        lastSyncError: null,
        lastSyncErrorAt: null,
        lastSyncedAt: now,
        syncStatus: "succeeded",
        updatedAt: now,
      })
      .where(eq(messagingWorkspaces.id, messagingWorkspaceId));
  });
}

export async function recordMessagingWorkspaceSyncFailure(input: {
  error: string;
  externalWorkspaceId: string;
  tenantIntegrationId: string;
  workspaceDisplayName: string | null;
}) {
  const db = getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    const messagingWorkspaceId = await upsertMessagingWorkspace(tx, {
      externalWorkspaceId: input.externalWorkspaceId,
      now,
      tenantIntegrationId: input.tenantIntegrationId,
      workspaceDisplayName: input.workspaceDisplayName,
    });

    await tx
      .update(messagingWorkspaces)
      .set({
        lastSyncError: input.error,
        lastSyncErrorAt: now,
        syncStatus: "failed",
        updatedAt: now,
      })
      .where(eq(messagingWorkspaces.id, messagingWorkspaceId));
  });
}

export async function getTenantSlackBotToken(tenantId: string) {
  const db = getDb();
  const [integrationSecret] = await db
    .select({
      ciphertext: integrationSecrets.ciphertext,
    })
    .from(integrationSecrets)
    .innerJoin(
      tenantIntegrations,
      eq(integrationSecrets.tenantIntegrationId, tenantIntegrations.id),
    )
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
        eq(integrationSecrets.secretType, SLACK_BOT_TOKEN_SECRET_TYPE),
      ),
    )
    .limit(1);

  if (integrationSecret?.ciphertext) {
    return decryptControlPlaneSecret(integrationSecret.ciphertext);
  }

  const [row] = await db
    .select({
      slackBotTokenCiphertext: tenantOnboardingSessions.slackBotTokenCiphertext,
    })
    .from(tenantOnboardingSessions)
    .where(eq(tenantOnboardingSessions.tenantId, tenantId))
    .orderBy(desc(tenantOnboardingSessions.createdAt))
    .limit(1);

  if (!row?.slackBotTokenCiphertext) {
    return null;
  }

  return decryptControlPlaneSecret(row.slackBotTokenCiphertext);
}

export async function getLatestTenantDesiredState(tenantId: string) {
  const db = getDb();
  const [desiredState] = await db
    .select({
      configJson: tenantDesiredStates.configJson,
      version: tenantDesiredStates.version,
    })
    .from(tenantDesiredStates)
    .where(eq(tenantDesiredStates.tenantId, tenantId))
    .orderBy(desc(tenantDesiredStates.version))
    .limit(1);

  if (!desiredState) {
    throw new Error(`No desired state found for tenant ${tenantId}`);
  }

  return desiredState;
}

export async function getTenantDesiredStateByVersion(input: {
  tenantId: string;
  version: number;
}) {
  const db = getDb();
  const [desiredState] = await db
    .select({
      configJson: tenantDesiredStates.configJson,
      version: tenantDesiredStates.version,
    })
    .from(tenantDesiredStates)
    .where(
      and(
        eq(tenantDesiredStates.tenantId, input.tenantId),
        eq(tenantDesiredStates.version, input.version),
      ),
    )
    .limit(1);

  if (!desiredState) {
    throw new Error(
      `Desired state version ${input.version} not found for tenant ${input.tenantId}`,
    );
  }

  return desiredState;
}

export async function getTenantRuntimeGatewayToken(tenantId: string) {
  const db = getDb();
  const [secret] = await db
    .select({
      ciphertext: tenantRuntimeSecrets.ciphertext,
    })
    .from(tenantRuntimeSecrets)
    .where(
      and(
        eq(tenantRuntimeSecrets.tenantId, tenantId),
        eq(tenantRuntimeSecrets.secretType, OPENCLAW_GATEWAY_TOKEN_SECRET_TYPE),
      ),
    )
    .limit(1);

  if (!secret?.ciphertext) {
    return null;
  }

  return decryptControlPlaneSecret(secret.ciphertext);
}

export async function ensureTenantRuntimeGatewayToken(tenantId: string) {
  const existingToken = await getTenantRuntimeGatewayToken(tenantId);

  if (existingToken) {
    return existingToken;
  }

  const gatewayToken = buildGatewayToken();
  await storeTenantRuntimeGatewayToken({
    gatewayToken,
    tenantId,
  });

  return gatewayToken;
}

export async function storeTenantRuntimeGatewayToken(input: {
  gatewayToken: string;
  tenantId: string;
}) {
  const db = getDb();
  const now = new Date();
  const ciphertext = encryptControlPlaneSecret(input.gatewayToken);

  const [existingSecret] = await db
    .select({
      id: tenantRuntimeSecrets.id,
    })
    .from(tenantRuntimeSecrets)
    .where(
      and(
        eq(tenantRuntimeSecrets.tenantId, input.tenantId),
        eq(tenantRuntimeSecrets.secretType, OPENCLAW_GATEWAY_TOKEN_SECRET_TYPE),
      ),
    )
    .limit(1);

  if (existingSecret) {
    await db
      .update(tenantRuntimeSecrets)
      .set({
        ciphertext,
        rotatedAt: now,
      })
      .where(eq(tenantRuntimeSecrets.id, existingSecret.id));

    return;
  }

  await db.insert(tenantRuntimeSecrets).values({
    ciphertext,
    secretType: OPENCLAW_GATEWAY_TOKEN_SECRET_TYPE,
    tenantId: input.tenantId,
  });
}

export async function enqueueTenantConfigApply(input: {
  desiredStateVersion: number;
  tenantId: string;
}) {
  const db = getDb();
  const jobId = await enqueueJob({
    jobType: JOB_TYPES.applyTenantConfig,
    payload: {
      desiredStateVersion: input.desiredStateVersion,
      tenantId: input.tenantId,
    },
  });

  await db.insert(tenantApplyRuns).values({
    desiredStateVersion: input.desiredStateVersion,
    jobRunId: jobId,
    status: "queued",
    tenantId: input.tenantId,
  });

  return jobId;
}

async function upsertMessagingWorkspace(
  tx: DbTransaction,
  input: {
    externalWorkspaceId: string;
    now: Date;
    tenantIntegrationId: string;
    workspaceDisplayName: string | null;
  },
) {
  const [existingWorkspace] = await tx
    .select({
      id: messagingWorkspaces.id,
    })
    .from(messagingWorkspaces)
    .where(
      eq(messagingWorkspaces.tenantIntegrationId, input.tenantIntegrationId),
    )
    .limit(1);

  if (existingWorkspace) {
    await tx
      .update(messagingWorkspaces)
      .set({
        displayName: input.workspaceDisplayName,
        externalWorkspaceId: input.externalWorkspaceId,
        updatedAt: input.now,
      })
      .where(eq(messagingWorkspaces.id, existingWorkspace.id));

    return existingWorkspace.id;
  }

  const [workspace] = await tx
    .insert(messagingWorkspaces)
    .values({
      displayName: input.workspaceDisplayName,
      externalWorkspaceId: input.externalWorkspaceId,
      syncStatus: "pending",
      tenantIntegrationId: input.tenantIntegrationId,
    })
    .returning({
      id: messagingWorkspaces.id,
    });

  return workspace.id;
}

async function upsertSlackIntegrationForTenant(
  tx: DbTransaction,
  input: {
    botToken: string;
    installerUserId: string | null;
    now: Date;
    scopeCsv: string;
    slackBotUserId: string | null;
    slackTeamId: string;
    slackTeamName: string | null;
    tenantId: string;
  },
) {
  const [existingIntegration] = await tx
    .select({
      id: tenantIntegrations.id,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1);

  let tenantIntegrationId = existingIntegration?.id ?? null;

  if (tenantIntegrationId) {
    await tx
      .update(tenantIntegrations)
      .set({
        connectedAt: input.now,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
        status: "connected",
        updatedAt: input.now,
      })
      .where(eq(tenantIntegrations.id, tenantIntegrationId));
  } else {
    const [createdIntegration] = await tx
      .insert(tenantIntegrations)
      .values({
        connectedAt: input.now,
        providerKey: SLACK_PROVIDER_KEY,
        status: "connected",
        tenantId: input.tenantId,
      })
      .returning({
        id: tenantIntegrations.id,
      });

    tenantIntegrationId = createdIntegration.id;
  }

  const [existingInstallation] = await tx
    .select({
      id: slackInstallations.id,
    })
    .from(slackInstallations)
    .where(eq(slackInstallations.tenantIntegrationId, tenantIntegrationId))
    .limit(1);

  if (existingInstallation) {
    await tx
      .update(slackInstallations)
      .set({
        installerUserId: input.installerUserId,
        installedAt: input.now,
        scopeCsv: input.scopeCsv,
        slackBotUserId: input.slackBotUserId,
        slackTeamId: input.slackTeamId,
        slackTeamName: input.slackTeamName,
        updatedAt: input.now,
      })
      .where(eq(slackInstallations.id, existingInstallation.id));
  } else {
    await tx.insert(slackInstallations).values({
      installedAt: input.now,
      installerUserId: input.installerUserId,
      scopeCsv: input.scopeCsv,
      slackBotUserId: input.slackBotUserId,
      slackTeamId: input.slackTeamId,
      slackTeamName: input.slackTeamName,
      tenantIntegrationId,
    });
  }

  const [existingSecret] = await tx
    .select({
      id: integrationSecrets.id,
    })
    .from(integrationSecrets)
    .where(
      and(
        eq(integrationSecrets.tenantIntegrationId, tenantIntegrationId),
        eq(integrationSecrets.secretType, SLACK_BOT_TOKEN_SECRET_TYPE),
      ),
    )
    .limit(1);

  if (existingSecret) {
    await tx
      .update(integrationSecrets)
      .set({
        ciphertext: encryptControlPlaneSecret(input.botToken),
        rotatedAt: input.now,
      })
      .where(eq(integrationSecrets.id, existingSecret.id));
    return tenantIntegrationId;
  }

  await tx.insert(integrationSecrets).values({
    ciphertext: encryptControlPlaneSecret(input.botToken),
    secretType: SLACK_BOT_TOKEN_SECRET_TYPE,
    tenantIntegrationId,
  });

  return tenantIntegrationId;
}

async function recordSlackIntegrationError(
  tx: DbTransaction,
  input: {
    error: string;
    now: Date;
    tenantId: string;
  },
) {
  const [existingIntegration] = await tx
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      id: tenantIntegrations.id,
      status: tenantIntegrations.status,
    })
    .from(tenantIntegrations)
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1);

  if (!existingIntegration) {
    await tx.insert(tenantIntegrations).values({
      lastError: input.error,
      lastErrorAt: input.now,
      providerKey: SLACK_PROVIDER_KEY,
      status: "error",
      tenantId: input.tenantId,
    });
    return;
  }

  await tx
    .update(tenantIntegrations)
    .set({
      lastError: input.error,
      lastErrorAt: input.now,
      status: existingIntegration.connectedAt
        ? existingIntegration.status
        : "error",
      updatedAt: input.now,
    })
    .where(eq(tenantIntegrations.id, existingIntegration.id));
}

async function createNextDesiredStateVersion(
  tx: DbTransaction,
  input: {
    tenantId: string;
  },
) {
  const [latestDesiredState] = await tx
    .select({
      version: tenantDesiredStates.version,
    })
    .from(tenantDesiredStates)
    .where(eq(tenantDesiredStates.tenantId, input.tenantId))
    .orderBy(desc(tenantDesiredStates.version))
    .limit(1);

  const nextVersion = (latestDesiredState?.version ?? 0) + 1;
  const configJson = await compileTenantDesiredStateConfig(tx, input.tenantId);

  const [createdDesiredState] = await tx
    .insert(tenantDesiredStates)
    .values({
      configJson,
      tenantId: input.tenantId,
      version: nextVersion,
    })
    .returning({
      configJson: tenantDesiredStates.configJson,
      version: tenantDesiredStates.version,
    });

  return createdDesiredState;
}

async function compileTenantDesiredStateConfig(
  tx: DbTransaction,
  tenantId: string,
) {
  const [slackIntegration] = await tx
    .select({
      connectedAt: tenantIntegrations.connectedAt,
      disconnectedAt: tenantIntegrations.disconnectedAt,
      installerUserId: slackInstallations.installerUserId,
      slackBotUserId: slackInstallations.slackBotUserId,
      slackTeamId: slackInstallations.slackTeamId,
      slackTeamName: slackInstallations.slackTeamName,
    })
    .from(tenantIntegrations)
    .leftJoin(
      slackInstallations,
      eq(slackInstallations.tenantIntegrationId, tenantIntegrations.id),
    )
    .where(
      and(
        eq(tenantIntegrations.tenantId, tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    )
    .limit(1);

  const config: Record<string, unknown> = {
    integrations: [],
    prompts: {},
  };

  if (
    slackIntegration?.connectedAt &&
    !slackIntegration.disconnectedAt &&
    slackIntegration.slackTeamId
  ) {
    config.integrations = ["slack"];
    config.slack = {
      installerUserId: slackIntegration.installerUserId,
      slackBotUserId: slackIntegration.slackBotUserId,
      teamId: slackIntegration.slackTeamId,
      teamName: slackIntegration.slackTeamName,
    };
  }

  return config;
}

async function markSlackIntegrationPendingApply(
  tx: DbTransaction,
  input: {
    now: Date;
    tenantId: string;
  },
) {
  await tx
    .update(tenantIntegrations)
    .set({
      lastError: null,
      lastErrorAt: null,
      status: "pending_apply",
      updatedAt: input.now,
    })
    .where(
      and(
        eq(tenantIntegrations.tenantId, input.tenantId),
        eq(tenantIntegrations.providerKey, SLACK_PROVIDER_KEY),
      ),
    );
}

function buildGatewayToken() {
  return randomBytes(24).toString("base64url");
}

function normalizeJsonValue(value: unknown) {
  if (value === undefined) {
    return null;
  }

  return value;
}

function deriveTenantName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "tenant";
}

function normalizeOrganizationSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createTenantForOrganization(input: {
  organizationId: string;
  tenantName: string;
  userExternalId: string;
}) {
  const db = getDb();

  const authorizedMembership = await db
    .select({
      organizationId: memberships.organizationId,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.organizationId, input.organizationId),
        eq(users.externalId, input.userExternalId),
      ),
    );

  if (authorizedMembership.length === 0) {
    throw new Error("You do not have access to this organization");
  }

  const createdTenant = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({
        organizationId: input.organizationId,
        name: input.tenantName,
        status: "provisioning",
      })
      .returning({
        id: tenants.id,
      });

    await tx.insert(tenantServers).values({
      tenantId: tenant.id,
      provider: "hetzner",
      sshUsername: "openclaw",
      status: "creating",
    });

    await createNextDesiredStateVersion(tx, {
      tenantId: tenant.id,
    });

    return tenant;
  });

  await enqueueJob({
    jobType: JOB_TYPES.provisionTenantServer,
    payload: {
      tenantId: createdTenant.id,
      step: "create_server",
    },
  });
}
