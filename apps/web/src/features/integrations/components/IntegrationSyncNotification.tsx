import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  fetchWorkspaceJobStatus,
  workspaceIntegrationDetailQueryOptions,
  workspaceIntegrationsQueryOptions,
} from "@/features/integrations/api/integrations"
import { SpinnerGapIcon } from "@phosphor-icons/react"

const MIN_DISPLAY_MS = 10_000
const POLL_INTERVAL_MS = 1_000

export interface IntegrationSyncNotificationProps {
  integrationKey: string
  jobId: string
  message: string
  onDone: () => void
  orgSlug: string
}

function FloatingStatusChip(props: { message: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-green-600 px-3 py-1.5 shadow-lg">
        <SpinnerGapIcon className="size-3 animate-spin text-white" />
        <span className="text-xs font-medium text-white">{props.message}</span>
      </div>
    </div>
  )
}

export function IntegrationSyncNotification({
  integrationKey,
  jobId,
  message,
  onDone,
  orgSlug,
}: IntegrationSyncNotificationProps) {
  const queryClient = useQueryClient()
  const [visible, setVisible] = useState(true)
  const startedAt = useRef(Date.now())
  const doneRef = useRef(false)

  useEffect(() => {
    if (!jobId) {
      return
    }

    const intervalId = window.setInterval(async () => {
      try {
        const status = await fetchWorkspaceJobStatus({
          jobId,
          orgSlug,
        })

        if (
          status.status !== "queued" &&
          status.status !== "running" &&
          !doneRef.current
        ) {
          doneRef.current = true
          const elapsed = Date.now() - startedAt.current
          const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)

          window.setTimeout(async () => {
            setVisible(false)

            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: workspaceIntegrationsQueryOptions(orgSlug).queryKey,
              }),
              queryClient.invalidateQueries({
                queryKey: workspaceIntegrationDetailQueryOptions({
                  integrationKey,
                  orgSlug,
                }).queryKey,
              }),
            ])

            if (status.status === "failed") {
              toast.error("Sync failed", {
                description: status.error ?? "The sync job failed.",
              })
            }

            onDone()
          }, remaining)
        }
      } catch {
        // Ignore transient polling failures while the job is running.
      }
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [integrationKey, jobId, onDone, orgSlug, queryClient])

  if (!visible) {
    return null
  }

  return <FloatingStatusChip message={message} />
}
