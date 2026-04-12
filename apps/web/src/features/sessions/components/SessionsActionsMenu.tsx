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

import { refreshWorkspaceSessions } from "../api/sessions"
import { SessionsSyncNotification } from "./SessionsSyncNotification"

export interface SessionsActionsMenuProps {
  orgSlug: string
}

export function SessionsActionsMenu({ orgSlug }: SessionsActionsMenuProps) {
  const [syncJobId, setSyncJobId] = useState<string | null>(null)

  async function handleSync() {
    try {
      const response = await refreshWorkspaceSessions(orgSlug)
      setSyncJobId(response.jobId)
    } catch (error) {
      toast.error("Session sync failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return (
    <>
      {syncJobId ? (
        <SessionsSyncNotification
          jobId={syncJobId}
          message="Syncing Sessions"
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
            {syncJobId ? "Syncing..." : "Sync Session Transcripts"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
