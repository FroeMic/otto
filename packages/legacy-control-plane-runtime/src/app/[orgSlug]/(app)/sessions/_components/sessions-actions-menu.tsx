"use client";

import { ArrowsClockwise, DotsThree } from "@phosphor-icons/react/ssr";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { SyncNotification } from "../../../../../components/sync-notification";
import { Button } from "../../../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../../components/ui/dropdown-menu";

export function SessionsActionsMenu({ orgSlug }: { orgSlug: string }) {
  const [syncJobId, setSyncJobId] = useState<string | null>(null);

  async function handleSync() {
    try {
      const response = await fetch(
        `/api/workspace/${orgSlug}/sessions/refresh`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        toast.error("Session sync failed", {
          description: data.error ?? "Unknown error",
        });
      } else {
        setSyncJobId(data.jobId);
      }
    } catch (error) {
      toast.error("Session sync failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
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
          message="Syncing Sessions"
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
            {syncJobId ? "Syncing..." : "Sync Session Transcripts"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
