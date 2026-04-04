"use client";

import { ArrowsClockwise, DotsThree } from "@phosphor-icons/react/ssr";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { SyncNotification } from "@/components/sync-notification";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ScheduledTasksActionsMenu({ orgSlug }: { orgSlug: string }) {
  const [syncJobId, setSyncJobId] = useState<string | null>(null);

  async function handleSync() {
    try {
      const response = await fetch(
        `/api/workspace/${orgSlug}/scheduled-tasks/refresh`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        jobId?: string;
        ok?: boolean;
      } | null;

      if (!response.ok || !body?.ok) {
        throw new Error(
          body?.error ?? `Sync failed with status ${response.status}.`,
        );
      }

      if (!body.jobId) {
        throw new Error("Sync job did not return a job ID.");
      }

      setSyncJobId(body.jobId);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to sync scheduled tasks.",
      );
    }
  }

  const handleDone = useCallback(() => {
    setSyncJobId(null);
  }, []);

  return (
    <>
      {syncJobId ? (
        <SyncNotification
          jobId={syncJobId}
          message="Syncing Tasks"
          onDone={handleDone}
          orgSlug={orgSlug}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              disabled={syncJobId !== null}
            />
          }
        >
          <DotsThree className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem disabled={syncJobId !== null} onClick={handleSync}>
            <ArrowsClockwise className="size-4" />
            {syncJobId ? "Syncing..." : "Sync Scheduled Tasks"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
