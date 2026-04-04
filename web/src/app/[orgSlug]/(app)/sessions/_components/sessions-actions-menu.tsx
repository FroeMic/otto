"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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

export function SessionsActionsMenu({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const response = await fetch(
        `/api/workspace/${orgSlug}/sessions/refresh`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        toast.error("Session refresh failed", {
          description: data.error ?? "Unknown error",
        });
      } else {
        toast.success("Session refresh started", {
          description: `Job ${data.jobId} queued.`,
        });
        router.refresh();
      }
    } catch (error) {
      toast.error("Session refresh failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" disabled={isRefreshing} />
        }
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={isRefreshing}
          onClick={handleRefresh}
        >
          <HugeiconsIcon
            icon={ArrowReloadHorizontalIcon}
            className="size-4"
          />
          {isRefreshing ? "Refreshing..." : "Refresh from runtime"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
