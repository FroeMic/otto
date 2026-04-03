"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MoreHorizontalIcon,
  ArrowReloadHorizontalIcon,
} from "@hugeicons/core-free-icons";

export function SlackActionsMenu({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleResyncDirectory() {
    setIsSyncing(true);
    try {
      const response = await fetch(
        `/api/workspace/${orgSlug}/slack/resync-directory`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        console.error("Resync failed:", data.error);
      }
      router.refresh();
    } catch (error) {
      console.error("Resync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }

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
        <DropdownMenuItem
          disabled={isSyncing}
          onClick={handleResyncDirectory}
        >
          <HugeiconsIcon
            icon={ArrowReloadHorizontalIcon}
            className="size-4"
          />
          {isSyncing ? "Syncing..." : "Resync users & channels"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
