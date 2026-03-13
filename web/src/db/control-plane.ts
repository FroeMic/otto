import type { User } from "@workos-inc/node";
import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  jobEvents,
  jobRuns,
  memberships,
  organizations,
  tenantDesiredStates,
  tenantServers,
  tenants,
  users,
} from "@/db/schema";
import { enqueueJob } from "@/lib/jobs/queue";
import { JOB_TYPES } from "@/lib/jobs/types";
import { getWorkOS } from "@/lib/workos";

export type DashboardOrganization = {
  id: string;
  externalId: string;
  name: string;
  role: string;
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
    name: organization.organizationName,
    role: organization.role,
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

export async function createWorkspaceWithFirstTenant(input: {
  workspaceName: string;
  tenantName: string;
  user: User;
}) {
  const workos = getWorkOS();
  const db = getDb();
  const syncedUser = await syncUserFromSession(input.user);

  const organization = await workos.organizations.createOrganization({
    name: input.workspaceName,
  });

  await workos.userManagement.createOrganizationMembership({
    organizationId: organization.id,
    userId: input.user.id,
  });

  const localOrganization = await db.transaction(async (tx) => {
    const [createdOrganization] = await tx
      .insert(organizations)
      .values({
        externalId: organization.id,
        name: organization.name,
      })
      .returning({
        id: organizations.id,
      });

    await tx.insert(memberships).values({
      organizationId: createdOrganization.id,
      userId: syncedUser.id,
      role: "admin",
    });

    const [tenant] = await tx
      .insert(tenants)
      .values({
        organizationId: createdOrganization.id,
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

    return {
      organizationId: createdOrganization.id,
      tenantId: tenant.id,
    };
  });

  await enqueueJob({
    jobType: JOB_TYPES.provisionTenantServer,
    payload: {
      tenantId: localOrganization.tenantId,
      step: "create_server",
    },
  });
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
