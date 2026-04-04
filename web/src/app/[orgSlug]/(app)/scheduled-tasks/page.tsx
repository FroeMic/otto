import {
  AlertCircleIcon,
  ArrowReloadHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { RefreshScheduledTasksButton } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/refresh-scheduled-tasks-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getLatestTenantScheduledTasksRefreshJob,
  isScheduledTaskStale,
  listTenantScheduledTaskSessions,
  listTenantScheduledTasks,
} from "@/db/scheduled-tasks";
import { getPrimaryAgent, isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ScheduledTasksPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const agent = getPrimaryAgent(organization);

  if (!agent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Tasks</CardTitle>
          <CardDescription>
            Scheduled work appears here once Otto is provisioned for this
            workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const [tasks, recentRuns, latestRefreshJob] = await Promise.all([
    listTenantScheduledTasks({ tenantId: agent.id }),
    listTenantScheduledTaskSessions({ tenantId: agent.id, limit: 25 }),
    getLatestTenantScheduledTasksRefreshJob({ tenantId: agent.id }),
  ]);

  const activeCount = tasks.filter((task) => task.status === "active").length;
  const pausedCount = tasks.filter((task) => task.status === "paused").length;
  const syncFailedCount = tasks.filter(
    (task) => task.status === "sync_failed" || task.lastSyncError,
  ).length;
  const staleCount = tasks.filter((task) =>
    isScheduledTaskStale(task.lastSyncedAt),
  ).length;

  const latestSyncedAt = tasks.reduce<Date | null>((latest, task) => {
    if (!latest) {
      return task.lastSyncedAt;
    }
    return latest > task.lastSyncedAt ? latest : task.lastSyncedAt;
  }, null);

  const syncState = getSyncState({
    hasSyncFailure: syncFailedCount > 0,
    latestRefreshJob,
    latestSyncedAt,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Scheduled Tasks
            </h1>
            <Badge variant={syncState.variant}>{syncState.label}</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            View the current scheduled work in this workspace and pull the
            latest runtime state on demand.
          </p>
        </div>
        <RefreshScheduledTasksButton orgSlug={organization.slug} />
      </div>

      {syncState.message ? (
        <Alert
          variant={
            syncState.variant === "destructive" ? "destructive" : "default"
          }
        >
          <HugeiconsIcon
            className="size-4"
            icon={
              syncState.variant === "destructive"
                ? AlertCircleIcon
                : ArrowReloadHorizontalIcon
            }
          />
          <AlertTitle>{syncState.label}</AlertTitle>
          <AlertDescription>{syncState.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Active" value={activeCount} />
        <SummaryCard label="Paused" value={pausedCount} />
        <SummaryCard label="Sync failed" value={syncFailedCount} />
        <SummaryCard label="Stale" value={staleCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>
            Current schedules pulled from the runtime and stored for this
            workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <EmptyState
              description={
                latestRefreshJob
                  ? "No scheduled tasks are currently registered in the runtime."
                  : "No runtime sync has been run yet."
              }
              title="No scheduled tasks yet"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead>Last sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{task.name}</span>
                        {task.description ? (
                          <span className="text-sm text-muted-foreground">
                            {task.description}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {task.scheduleExpression}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={taskStatusVariant(task.status)}>
                        {formatStatusLabel(task.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(task.lastRunAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(task.nextRunAt)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        <span>{formatDateTime(task.lastSyncedAt)}</span>
                        {task.lastSyncError ? (
                          <span className="text-destructive">
                            {task.lastSyncError}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
          <CardDescription>
            Latest scheduled task runs with direct links into matching sessions
            when the runtime reported a session key.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <EmptyState
              description="Runs will appear here after the next scheduled task execution."
              title="No scheduled task runs yet"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled for</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead>Session</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{run.taskName}</span>
                        {run.summary ? (
                          <span className="text-sm text-muted-foreground">
                            {run.summary}
                          </span>
                        ) : run.error ? (
                          <span className="text-sm text-destructive">
                            {run.error}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={runStatusVariant(run.status)}>
                        {formatStatusLabel(run.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(run.scheduledFor)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(run.startedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(run.finishedAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {run.runtimeSessionKey ? (
                        <Link
                          className="text-foreground underline underline-offset-4"
                          href={`/${organization.slug}/sessions/${encodeURIComponent(run.runtimeSessionKey)}`}
                        >
                          View session
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          No linked session
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function EmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function taskStatusVariant(status: string) {
  if (status === "active") {
    return "default" as const;
  }
  if (status === "sync_failed") {
    return "destructive" as const;
  }
  return "secondary" as const;
}

function runStatusVariant(status: string) {
  if (status === "succeeded") {
    return "secondary" as const;
  }
  if (status === "failed") {
    return "destructive" as const;
  }
  return "outline" as const;
}

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function getSyncState(input: {
  hasSyncFailure: boolean;
  latestRefreshJob: Awaited<
    ReturnType<typeof getLatestTenantScheduledTasksRefreshJob>
  >;
  latestSyncedAt: Date | null;
}) {
  if (
    input.latestRefreshJob?.status === "queued" ||
    input.latestRefreshJob?.status === "running"
  ) {
    return {
      label: "Refreshing",
      message: "A runtime refresh job is currently running.",
      variant: "outline" as const,
    };
  }

  if (input.latestRefreshJob?.status === "failed") {
    return {
      label: "Sync failed",
      message:
        input.latestRefreshJob.error ??
        "The latest runtime refresh failed. Use the refresh action to retry.",
      variant: "destructive" as const,
    };
  }

  if (!input.latestSyncedAt && !input.latestRefreshJob) {
    return {
      label: "Not synced",
      message:
        "Run the first refresh to import scheduled tasks from the runtime.",
      variant: "outline" as const,
    };
  }

  if (input.hasSyncFailure) {
    return {
      label: "Sync failed",
      message:
        "Stored scheduled task data is out of sync with the runtime. Refresh to repair it.",
      variant: "destructive" as const,
    };
  }

  if (input.latestSyncedAt && isScheduledTaskStale(input.latestSyncedAt)) {
    return {
      label: "Stale",
      message:
        "This view is showing older runtime data. Refresh from runtime to pull the latest tasks and runs.",
      variant: "outline" as const,
    };
  }

  return {
    label: "Current",
    message: null,
    variant: "secondary" as const,
  };
}
