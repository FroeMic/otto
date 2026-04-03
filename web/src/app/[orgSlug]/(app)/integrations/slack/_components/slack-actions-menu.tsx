"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MoreHorizontalIcon,
  ArrowReloadHorizontalIcon,
  UserMultiple02Icon,
  MessageMultiple01Icon,
} from "@hugeicons/core-free-icons";

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
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);
  const [isSyncingChannels, setIsSyncingChannels] = useState(false);

  async function handleResync(action: "users" | "channels") {
    const setter = action === "users" ? setIsSyncingUsers : setIsSyncingChannels;
    setter(true);
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
        toast.success(`Resync ${action} started`, {
          description: `Job ${data.jobId} queued. Check worker logs for progress.`,
        });
        router.refresh();
      }
    } catch (error) {
      toast.error(`Resync ${action} failed`, {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setter(false);
    }
  }

  const isSyncing = isSyncingUsers || isSyncingChannels;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" disabled={isSyncing} />
        }
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canReconnect && reconnectUrl ? (
          <>
            <DropdownMenuItem
              render={<a href={reconnectUrl} />}
            >
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
          disabled={isSyncingUsers}
          onClick={() => handleResync("users")}
        >
          <HugeiconsIcon icon={UserMultiple02Icon} className="size-4" />
          {isSyncingUsers ? "Syncing users..." : "Resync users"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isSyncingChannels}
          onClick={() => handleResync("channels")}
        >
          <HugeiconsIcon icon={MessageMultiple01Icon} className="size-4" />
          {isSyncingChannels ? "Syncing channels..." : "Resync channels"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
