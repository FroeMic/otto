import { ArrowsClockwiseIcon, DotsThreeIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { refreshWorkspaceScheduledTasks } from "../api/scheduled-tasks"
import { ScheduledTasksSyncNotification } from "./ScheduledTasksSyncNotification"

export interface ScheduledTasksActionsMenuProps {
  orgSlug: string
}

export function ScheduledTasksActionsMenu({
  orgSlug,
}: ScheduledTasksActionsMenuProps) {
  const [syncJobId, setSyncJobId] = useState<string | null>(null)

  async function handleSync() {
    try {
      const response = await refreshWorkspaceScheduledTasks(orgSlug)
      setSyncJobId(response.jobId)
    } catch (error) {
      toast.error("Scheduled task sync failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return (
    <>
      {syncJobId ? (
        <ScheduledTasksSyncNotification
          jobId={syncJobId}
          message="Syncing Tasks"
          onDone={() => setSyncJobId(null)}
          orgSlug={orgSlug}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              disabled={syncJobId !== null}
              size="icon"
              type="button"
              variant="outline"
            />
          }
        >
          <DotsThreeIcon className="size-4" weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem
            disabled={syncJobId !== null}
            onClick={() => {
              void handleSync()
            }}
          >
            <ArrowsClockwiseIcon className="size-4" />
            {syncJobId ? "Syncing..." : "Sync Scheduled Tasks"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
