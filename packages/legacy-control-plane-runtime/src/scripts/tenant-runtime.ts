import "dotenv/config";

import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  enqueueTenantConfigApply,
  ensureCurrentTenantDesiredStateVersion,
} from "../db/control-plane";
import {
  jobEvents,
  jobRuns,
  organizations,
  tenantApplyRuns,
  tenantServers,
  tenants,
} from "../db/schema";
import { logCliError } from "../lib/cli-error";
import { getEnv } from "../lib/env";
import { JOB_STATUSES } from "../lib/jobs/types";
import { getTenantRuntimeConnection } from "../lib/runtime/connection";
import { RuntimeManager } from "../lib/runtime/manager";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 15 * 60_000;
const runtimeManager = new RuntimeManager();

type Command = "apply" | "deploy" | "refresh-image" | "recompile-desired-state";

type TenantTarget = {
  ipv4: string | null;
  serverStatus: string | null;
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  targetRef: string;
  targetMode: "org-slug";
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

  if (
    !command ||
    (command !== "apply" &&
      command !== "deploy" &&
      command !== "refresh-image" &&
      command !== "recompile-desired-state")
  ) {
    printUsage();
    process.exit(1);
  }

  const options = parseOptions(args.slice(1));
  const tenant = await resolveTenantTarget(options.target);

  if (!tenant) {
    throw new Error(
      `No tenant found for organization slug "${options.target.value}".`,
    );
  }

  if (command === "apply") {
    await runApply(tenant, options, {
      pullImageFirst: false,
    });
    return;
  }

  if (command === "deploy") {
    await runApply(tenant, options, {
      pullImageFirst: true,
    });
    return;
  }

  if (command === "recompile-desired-state") {
    await runRecompileDesiredState(tenant);
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
  input: {
    pullImageFirst: boolean;
  },
) {
  const runtimeConnection = await getTenantRuntimeConnection(
    tenant.tenantId,
    "tenant runtime apply script",
  );
  const desiredState = await ensureCurrentTenantDesiredStateVersion({
    tenantId: tenant.tenantId,
  });
  const jobId = await enqueueTenantConfigApply({
    desiredStateVersion: desiredState.version,
    ...(input.pullImageFirst ? { pullImageFirst: true } : {}),
    tenantId: tenant.tenantId,
  });

  console.info(
    JSON.stringify(
      {
        action: input.pullImageFirst ? "deploy" : "apply",
        host: runtimeConnection.host,
        image: getEnv().RUNTIME_OPENCLAW_IMAGE,
        jobId,
        note: input.pullImageFirst
          ? "apply_tenant_config will pull the configured runtime image before recreating the runtime container"
          : "apply_tenant_config will restart the existing runtime container without pulling a new image",
        targetMode: tenant.targetMode,
        targetRef: tenant.targetRef,
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
        desiredStateChanged: desiredState.changed,
        desiredStateVersion: desiredState.version,
        pullImageFirst: input.pullImageFirst,
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
        action: input.pullImageFirst ? "deploy" : "apply",
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
  const restart =
    await runtimeManager.restartGatewayWithResult(runtimeConnection);
  const verify =
    await runtimeManager.checkGatewayHealthWithResult(runtimeConnection);

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

async function runRecompileDesiredState(tenant: TenantTarget) {
  const desiredState = await ensureCurrentTenantDesiredStateVersion({
    tenantId: tenant.tenantId,
  });

  console.info(
    JSON.stringify(
      {
        action: "recompile-desired-state",
        desiredStateChanged: desiredState.changed,
        desiredStateVersion: desiredState.version,
        targetMode: tenant.targetMode,
        targetRef: tenant.targetRef,
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
      },
      null,
      2,
    ),
  );
}

async function resolveTenantTarget(target: {
  mode: "org-slug";
  value: string;
}): Promise<TenantTarget | null> {
  return await getLatestTenantForOrganizationSlug(target.value);
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
      applyRun.status === "pulling_runtime_image" ||
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

async function getApplyRunByJobId(
  jobRunId: string,
): Promise<ApplyRunStatus | null> {
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
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let orgSlug: string | null = null;

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

    if (arg === "--orgslug" || arg === "--org-slug") {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a value.`);
      }
      orgSlug = value;
      index += 1;
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

  if (orgSlug === null) {
    throw new Error("Pass --orgslug <slug>.");
  }

  return {
    pollIntervalMs,
    target: {
      mode: "org-slug" as const,
      value: orgSlug,
    },
    timeoutMs,
    wait,
  };
}

function printUsage() {
  console.error(`Usage:
  bun src/scripts/tenant-runtime.ts apply --orgslug <org-slug> [--no-wait] [--poll-ms <ms>] [--timeout-ms <ms>]
  bun src/scripts/tenant-runtime.ts deploy --orgslug <org-slug> [--no-wait] [--poll-ms <ms>] [--timeout-ms <ms>]
  bun src/scripts/tenant-runtime.ts recompile-desired-state --orgslug <org-slug>
  bun src/scripts/tenant-runtime.ts refresh-image --orgslug <org-slug>

Examples:
  bun run tenant:runtime:apply -- --orgslug my-org
  bun run tenant:runtime:deploy -- --orgslug my-org
  bun run tenant:runtime:recompile-desired-state -- --orgslug my-org
  bun run tenant:runtime:refresh-image -- --orgslug my-org
  bun run tenant:runtime:apply -- --orgslug my-org --no-wait
`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  logCliError(error);
  process.exit(1);
});
