"use client";

import {
  ArrowsClockwise,
  ChatsTeardrop,
  DotsThree,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { SyncNotification } from "@/components/sync-notification";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SlackActionsMenu({
  canReconnect,
  orgSlug,
  reconnectUrl,
}: {
  canReconnect: boolean;
  orgSlug: string;
  reconnectUrl: string | null;
}) {
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");

  async function handleResync(action: "users" | "channels") {
    try {
      const response = await fetch(
        `/api/workspace/${orgSlug}/slack/resync-directory`,
        {
          body: JSON.stringify({ action }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const data = await response.json();

      if (!response.ok || !data.ok) {
        toast.error(`Resync ${action} failed`, {
          description: data.error ?? "Unknown error",
        });
        return;
      }

      setSyncMessage(action === "users" ? "Syncing Users" : "Syncing Channels");
      setSyncJobId(data.jobId);
    } catch (error) {
      toast.error(`Resync ${action} failed`, {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const handleDone = useCallback(() => {
    setSyncJobId(null);
    setSyncMessage("");
  }, []);

  return (
    <>
      {syncJobId ? (
        <SyncNotification
          jobId={syncJobId}
          message={syncMessage}
          onDone={handleDone}
          orgSlug={orgSlug}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Slack actions"
              disabled={syncJobId !== null}
              size="icon"
              variant="outline"
            />
          }
        >
          <DotsThree className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canReconnect && reconnectUrl ? (
            <>
              <DropdownMenuItem
                onClick={() => window.location.assign(reconnectUrl)}
              >
                <ArrowsClockwise className="size-4" />
                Reconnect Slack
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            disabled={syncJobId !== null}
            onClick={() => handleResync("users")}
          >
            <UsersThree className="size-4" />
            Sync Users
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={syncJobId !== null}
            onClick={() => handleResync("channels")}
          >
            <ChatsTeardrop className="size-4" />
            Sync Channels
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
