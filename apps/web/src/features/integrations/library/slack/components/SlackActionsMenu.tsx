import {
  ArrowsClockwiseIcon,
  ChatsTeardropIcon,
  DotsThreeIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { enqueueWorkspaceSlackDirectoryResync } from "@/features/integrations/api/integrations"
import { IntegrationSyncNotification } from "@/features/integrations/components/IntegrationSyncNotification"

export interface SlackActionsMenuProps {
  canReconnect: boolean
  orgSlug: string
  reconnectUrl: string | null
}

export function SlackActionsMenu({
  canReconnect,
  orgSlug,
  reconnectUrl,
}: SlackActionsMenuProps) {
  const [syncJobId, setSyncJobId] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState("")

  async function handleResync(action: "channels" | "users") {
    try {
      const result = await enqueueWorkspaceSlackDirectoryResync({
        action,
        orgSlug,
      })

      setSyncMessage(action === "users" ? "Syncing Users" : "Syncing Channels")
      setSyncJobId(result.jobId)
    } catch (error) {
      toast.error(`Resync ${action} failed`, {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return (
    <>
      {syncJobId ? (
        <IntegrationSyncNotification
          integrationKey="slack"
          jobId={syncJobId}
          message={syncMessage}
          onDone={() => {
            setSyncJobId(null)
            setSyncMessage("")
          }}
          orgSlug={orgSlug}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Slack actions"
              disabled={syncJobId !== null}
              size="icon-sm"
              variant="outline"
            />
          }
        >
          <DotsThreeIcon weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {canReconnect && reconnectUrl ? (
            <>
              <DropdownMenuItem
                onClick={() => {
                  window.location.assign(reconnectUrl)
                }}
              >
                <ArrowsClockwiseIcon className="size-4" />
                Reconnect Slack
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            disabled={syncJobId !== null}
            onClick={() => {
              void handleResync("users")
            }}
          >
            <UsersThreeIcon className="size-4" />
            Sync Users
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={syncJobId !== null}
            onClick={() => {
              void handleResync("channels")
            }}
          >
            <ChatsTeardropIcon className="size-4" />
            Sync Channels
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
