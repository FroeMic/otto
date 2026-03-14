import type { User } from "@workos-inc/node";
import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  jobEvents,
  jobRuns,
  memberships,
  organizations,
  tenantDesiredStates,
  tenantOnboardingSessions,
  tenantServers,
  tenants,
  users,
} from "@/db/schema";
import {
  decryptControlPlaneSecret,
  encryptControlPlaneSecret,
} from "@/lib/crypto";
import { enqueueJob } from "@/lib/jobs/queue";
import { JOB_TYPES } from "@/lib/jobs/types";
import { getWorkOS } from "@/lib/workos";

export type DashboardOrganization = {
  id: string;
  externalId: string;
  latestOnboardingSession: {
    createdAt: Date;
    id: string;
    slackTeamName: string | null;
    slackConnectedAt: Date | null;
    status: string;
    tenantName: string;
  } | null;
  onboardingDraft: {
    createdAt: Date;
    id: string;
    slackTeamName: string | null;
    slackConnectedAt: Date | null;
    status: string;
    tenantName: string;
  } | null;
  name: string;
  role: string;
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

export async function getDashboardOrganizations(
  userExternalId: string,
): Promise<DashboardOrganization[]> {
  const db = getDb();

  const organizationRows = await db
    .select({
      organizationId: organizations.id,
      organizationExternalId: organizations.externalId,
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

  return organizationRows.map((organization) => ({
    id: organization.organizationId,
    externalId: organization.organizationExternalId,
    latestOnboardingSession: buildOnboardingDraftSummary(
      latestOnboardingByOrganization.get(organization.organizationId) ?? null,
    ),
    onboardingDraft: buildOnboardingDraftSummary(
      onboardingByOrganization.get(organization.organizationId) ?? null,
    ),
    name: organization.organizationName,
    role: organization.role,
    slug: organization.organizationSlug,
    tenants: tenantRows
      .filter((tenant) => tenant.organizationId === organization.organizationId)
      .map((tenant) => ({
        createdAt: tenant.createdAt,
        id: tenant.id,
        ipv4: tenant.ipv4,
        latestJob: buildLatestJobSummary(
          latestJobsByTenant.get(tenant.id) ?? null,
          jobEventsByJobRunId,
        ),
        name: tenant.name,
        status: tenant.status,
        serverStatus: tenant.serverStatus,
      })),
  }));
}

function buildOnboardingDraftSummary(
  onboarding: {
    createdAt: Date;
    id: string;
    slackTeamName: string | null;
    slackConnectedAt: Date | null;
    status: string;
    tenantName: string;
  } | null,
) {
  if (!onboarding) {
    return null;
  }

  return {
    createdAt: onboarding.createdAt,
    id: onboarding.id,
    slackTeamName: onboarding.slackTeamName,
    slackConnectedAt: onboarding.slackConnectedAt,
    status: onboarding.status,
    tenantName: onboarding.tenantName,
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
      organizationSlug: organizations.slug,
      slackConnectedAt: tenantOnboardingSessions.slackConnectedAt,
      slackTeamId: tenantOnboardingSessions.slackTeamId,
      status: tenantOnboardingSessions.status,
      tenantId: tenantOnboardingSessions.tenantId,
      tenantName: tenantOnboardingSessions.tenantName,
      userId: users.id,
    })
    .from(tenantOnboardingSessions)
    .innerJoin(users, eq(tenantOnboardingSessions.userId, users.id))
    .innerJoin(
      organizations,
      eq(tenantOnboardingSessions.organizationId, organizations.id),
    )
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

  if (authorizedSession.tenantId) {
    return {
      organizationSlug: authorizedSession.organizationSlug,
      tenantId: authorizedSession.tenantId,
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

    await tx.insert(tenantServers).values({
      tenantId: tenant.id,
      provider: "hetzner",
      sshUsername: "openclaw",
      status: "creating",
    });

    await tx.insert(tenantDesiredStates).values({
      tenantId: tenant.id,
      version: 1,
      configJson: {
        integrations: ["slack"],
        prompts: {},
        slack: {
          installerUserId: input.installerUserId,
          slackBotUserId: input.slackBotUserId,
          teamId: input.slackTeamId,
          teamName: input.slackTeamName,
        },
      },
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

    return tenant;
  });

  await enqueueJob({
    jobType: JOB_TYPES.provisionTenantServer,
    payload: {
      tenantId: createdTenant.id,
      step: "create_server",
    },
  });

  return {
    organizationSlug: authorizedSession.organizationSlug,
    tenantId: createdTenant.id,
  };
}

export async function getTenantSlackBotToken(tenantId: string) {
  const db = getDb();
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

    await tx.insert(tenantDesiredStates).values({
      tenantId: tenant.id,
      version: 1,
      configJson: {
        integrations: [],
        prompts: {},
      },
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
