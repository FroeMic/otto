import "dotenv/config";

import { desc, eq, or } from "drizzle-orm";

import {
  enqueueTenantConfigApply,
  getLatestTenantDesiredState,
} from "@/db/control-plane";
import {
  jobEvents,
  jobRuns,
  organizations,
  tenantApplyRuns,
  tenantServers,
  tenants,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { getEnv } from "@/lib/env";
import { JOB_STATUSES } from "@/lib/jobs/types";
import { getTenantRuntimeConnection } from "@/lib/runtime/connection";
import { RuntimeManager } from "@/lib/runtime/manager";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 15 * 60_000;
const runtimeManager = new RuntimeManager();

type Command = "apply" | "refresh-image";

type TenantTarget = {
  ipv4: string | null;
  serverStatus: string | null;
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  targetRef: string;
  targetMode: "org-slug" | "tenant";
};

type ApplyRunStatus = {
  desiredStateVersion: number;
  error: string | null;
  finishedAt: Date | null;
  id: string;
  jobRunId: string;
  restartStderr: string | null;
  restartStdout: string | null;
  startedAt: Date | null;
  status: string;
  tenantId: string;
  verifyStderr: string | null;
  verifyStdout: string | null;
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] as Command | undefined;

  if (!command || (command !== "apply" && command !== "refresh-image")) {
    printUsage();
    process.exit(1);
  }

  const targetRef = args[1];

  if (!targetRef) {
    printUsage();
    process.exit(1);
  }

  const options = parseOptions(args.slice(2));
  const tenant = await resolveTenantTarget(targetRef, options.targetMode);

  if (!tenant) {
    throw new Error(
      options.targetMode === "org-slug"
        ? `No tenant found for organization slug "${targetRef}".`
        : `No tenant found for tenant ref "${targetRef}". Try the tenant name, tenant id, or pass --org-slug.`,
    );
  }

  if (command === "apply") {
    await runApply(tenant, options);
    return;
  }

  await runRefreshImage(tenant);
}

async function runApply(
  tenant: TenantTarget,
  options: {
    pollIntervalMs: number;
    timeoutMs: number;
    wait: boolean;
  },
) {
  const runtimeConnection = await getTenantRuntimeConnection(
    tenant.tenantId,
    "tenant runtime apply script",
  );
  const desiredState = await getLatestTenantDesiredState(tenant.tenantId);
  const jobId = await enqueueTenantConfigApply({
    desiredStateVersion: desiredState.version,
    tenantId: tenant.tenantId,
  });

  console.info(
    JSON.stringify(
      {
        action: "apply",
        host: runtimeConnection.host,
        image: getEnv().RUNTIME_OPENCLAW_IMAGE,
        jobId,
        note: "apply_tenant_config already pulls RUNTIME_OPENCLAW_IMAGE before recreating the runtime container",
        targetMode: tenant.targetMode,
        targetRef: tenant.targetRef,
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
        desiredStateVersion: desiredState.version,
      },
      null,
      2,
    ),
  );

  if (!options.wait) {
    return;
  }

  const result = await waitForApplyRun(jobId, options);
  const events = await getJobEvents(jobId);

  console.info(
    JSON.stringify(
      {
        action: "apply",
        events,
        result,
      },
      null,
      2,
    ),
  );

  if (result.status !== "succeeded") {
    process.exit(1);
  }
}

async function runRefreshImage(tenant: TenantTarget) {
  const runtimeConnection = await getTenantRuntimeConnection(
    tenant.tenantId,
    "tenant runtime image refresh",
  );
  const image = getEnv().RUNTIME_OPENCLAW_IMAGE;
  const restart = await runtimeManager.restartGatewayWithResult(runtimeConnection);
  const verify = await runtimeManager.checkGatewayHealthWithResult(
    runtimeConnection,
  );

  console.info(
    JSON.stringify(
      {
        action: "refresh-image",
        host: runtimeConnection.host,
        image,
        note: "restartGatewayWithResult pulls the configured runtime image before recreating the container",
        targetMode: tenant.targetMode,
        targetRef: tenant.targetRef,
        restartStderr: restart.stderr,
        restartStdout: restart.stdout,
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
        verifyStderr: verify.stderr,
        verifyStdout: verify.stdout,
      },
      null,
      2,
    ),
  );
}

async function resolveTenantTarget(
  targetRef: string,
  targetMode: "org-slug" | "tenant",
): Promise<TenantTarget | null> {
  if (targetMode === "org-slug") {
    return await getLatestTenantForOrganizationSlug(targetRef);
  }

  return await getLatestTenantByRef(targetRef);
}

async function getLatestTenantByRef(targetRef: string): Promise<TenantTarget | null> {
  const db = getDb();
  const [tenant] = await db
    .select({
      ipv4: tenantServers.ipv4,
      serverStatus: tenantServers.status,
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantStatus: tenants.status,
    })
    .from(tenants)
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(or(eq(tenants.id, targetRef), eq(tenants.name, targetRef)))
    .orderBy(desc(tenants.createdAt))
    .limit(1);

  if (!tenant) {
    return null;
  }

  return {
    ipv4: tenant.ipv4,
    serverStatus: tenant.serverStatus,
    targetMode: "tenant",
    targetRef,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    tenantStatus: tenant.tenantStatus,
  };
}

async function getLatestTenantForOrganizationSlug(
  orgSlug: string,
): Promise<TenantTarget | null> {
  const db = getDb();
  const [tenant] = await db
    .select({
      ipv4: tenantServers.ipv4,
      serverStatus: tenantServers.status,
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantStatus: tenants.status,
    })
    .from(tenants)
    .innerJoin(organizations, eq(tenants.organizationId, organizations.id))
    .leftJoin(tenantServers, eq(tenantServers.tenantId, tenants.id))
    .where(eq(organizations.slug, orgSlug))
    .orderBy(desc(tenants.createdAt))
    .limit(1);

  if (!tenant) {
    return null;
  }

  return {
    ipv4: tenant.ipv4,
    serverStatus: tenant.serverStatus,
    targetMode: "org-slug",
    targetRef: orgSlug,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    tenantStatus: tenant.tenantStatus,
  };
}

async function waitForApplyRun(
  jobRunId: string,
  options: {
    pollIntervalMs: number;
    timeoutMs: number;
  },
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < options.timeoutMs) {
    const applyRun = await getApplyRunByJobId(jobRunId);

    if (!applyRun) {
      throw new Error(`Apply run for job ${jobRunId} was not created.`);
    }

    if (
      applyRun.status === JOB_STATUSES.queued ||
      applyRun.status === JOB_STATUSES.running ||
      applyRun.status === "loading_desired_state" ||
      applyRun.status === "rendering_files" ||
      applyRun.status === "writing_files" ||
      applyRun.status === "restarting_runtime" ||
      applyRun.status === "verifying_runtime"
    ) {
      await sleep(options.pollIntervalMs);
      continue;
    }

    return applyRun;
  }

  throw new Error(
    `Timed out waiting for apply job ${jobRunId} after ${options.timeoutMs}ms.`,
  );
}

async function getApplyRunByJobId(jobRunId: string): Promise<ApplyRunStatus | null> {
  const db = getDb();
  const [applyRun] = await db
    .select({
      desiredStateVersion: tenantApplyRuns.desiredStateVersion,
      error: tenantApplyRuns.error,
      finishedAt: tenantApplyRuns.finishedAt,
      id: tenantApplyRuns.id,
      jobRunId: tenantApplyRuns.jobRunId,
      restartStderr: tenantApplyRuns.restartStderr,
      restartStdout: tenantApplyRuns.restartStdout,
      startedAt: tenantApplyRuns.startedAt,
      status: tenantApplyRuns.status,
      tenantId: tenantApplyRuns.tenantId,
      verifyStderr: tenantApplyRuns.verifyStderr,
      verifyStdout: tenantApplyRuns.verifyStdout,
    })
    .from(tenantApplyRuns)
    .innerJoin(jobRuns, eq(tenantApplyRuns.jobRunId, jobRuns.id))
    .where(eq(jobRuns.id, jobRunId))
    .limit(1);

  return applyRun ?? null;
}

async function getJobEvents(jobRunId: string) {
  const db = getDb();
  return await db
    .select({
      createdAt: jobEvents.createdAt,
      eventType: jobEvents.eventType,
      message: jobEvents.message,
    })
    .from(jobEvents)
    .where(eq(jobEvents.jobRunId, jobRunId))
    .orderBy(jobEvents.createdAt);
}

function parseOptions(args: string[]) {
  let wait = true;
  let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
  let targetMode: "org-slug" | "tenant" = "tenant";
  let timeoutMs = DEFAULT_TIMEOUT_MS;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--no-wait") {
      wait = false;
      continue;
    }

    if (arg === "--wait") {
      wait = true;
      continue;
    }

    if (arg === "--org-slug") {
      targetMode = "org-slug";
      continue;
    }

    if (arg === "--poll-ms") {
      const value = Number(args[index + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--poll-ms must be a positive integer.");
      }
      pollIntervalMs = value;
      index += 1;
      continue;
    }

    if (arg === "--timeout-ms") {
      const value = Number(args[index + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--timeout-ms must be a positive integer.");
      }
      timeoutMs = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    pollIntervalMs,
    targetMode,
    timeoutMs,
    wait,
  };
}

function printUsage() {
  console.error(`Usage:
  bun src/scripts/tenant-runtime.ts apply <tenant-name-or-id> [--no-wait] [--poll-ms <ms>] [--timeout-ms <ms>]
  bun src/scripts/tenant-runtime.ts refresh-image <tenant-name-or-id>
  bun src/scripts/tenant-runtime.ts apply <org-slug> --org-slug
  bun src/scripts/tenant-runtime.ts refresh-image <org-slug> --org-slug
`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
