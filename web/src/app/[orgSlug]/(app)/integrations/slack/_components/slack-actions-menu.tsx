"use client";

import {
  ArrowReloadHorizontalIcon,
  MessageMultiple01Icon,
  MoreHorizontalIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
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
  orgSlug,
  reconnectUrl,
  canReconnect,
}: {
  orgSlug: string;
  reconnectUrl: string | null;
  canReconnect: boolean;
}) {
  const router = useRouter();
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");

  async function handleResync(action: "users" | "channels") {
    try {
      const response = await fetch(
        `/api/workspace/${orgSlug}/slack/resync-directory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        toast.error(`Resync ${action} failed`, {
          description: data.error ?? "Unknown error",
        });
      } else {
        setSyncMessage(
          action === "users" ? "Syncing Users" : "Syncing Channels",
        );
        setSyncJobId(data.jobId);
      }
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
              variant="outline"
              size="icon"
              disabled={syncJobId !== null}
            />
          }
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canReconnect && reconnectUrl ? (
            <>
              <DropdownMenuItem onClick={() => router.push(reconnectUrl)}>
                <HugeiconsIcon
                  icon={ArrowReloadHorizontalIcon}
                  className="size-4"
                />
                Reconnect Slack
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            disabled={syncJobId !== null}
            onClick={() => handleResync("users")}
          >
            <HugeiconsIcon icon={UserMultiple02Icon} className="size-4" />
            Sync Users
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={syncJobId !== null}
            onClick={() => handleResync("channels")}
          >
            <HugeiconsIcon icon={MessageMultiple01Icon} className="size-4" />
            Sync Channels
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
