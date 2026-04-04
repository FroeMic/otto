import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { ScheduledTasksActionsMenu } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/refresh-scheduled-tasks-button";
import { ScheduledTasksTabs } from "@/app/[orgSlug]/(app)/scheduled-tasks/_components/scheduled-tasks-tabs";
import type { ScheduledTasksSyncState } from "@/app/[orgSlug]/(app)/scheduled-tasks/_lib/scheduled-tasks-sync-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export function ScheduledTasksShell({
  children,
  hideHeader = false,
  lastSyncedAt,
  orgSlug,
  showTabs = true,
  syncState,
}: {
  children: ReactNode;
  hideHeader?: boolean;
  lastSyncedAt: Date | null;
  orgSlug: string;
  showTabs?: boolean;
  syncState: ScheduledTasksSyncState;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {!hideHeader ? (
        <>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col gap-1">
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
                <p className="text-xs text-muted-foreground">
                  {lastSyncedAt
                    ? `Last synced ${formatDateTime(lastSyncedAt)}`
                    : "No runtime data imported yet."}
                </p>
              </div>
              <ScheduledTasksActionsMenu orgSlug={orgSlug} />
            </div>
            {showTabs ? <ScheduledTasksTabs orgSlug={orgSlug} /> : null}
          </div>

          {syncState.variant === "destructive" && syncState.message ? (
            <Alert variant="destructive">
              <HugeiconsIcon className="size-4" icon={AlertCircleIcon} />
              <AlertTitle>{syncState.label}</AlertTitle>
              <AlertDescription>{syncState.message}</AlertDescription>
            </Alert>
          ) : null}
        </>
      ) : null}

      {children}
    </div>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
