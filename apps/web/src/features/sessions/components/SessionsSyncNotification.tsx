import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { IntegrationFloatingStatusChip } from "@/features/integrations/components/IntegrationFloatingStatusChip"
import { fetchWorkspaceJobStatus } from "@/features/workspace/api/jobs"

import { workspaceSessionsQueryOptions } from "../api/sessions"

const MIN_DISPLAY_MS = 10_000
const POLL_INTERVAL_MS = 1_000

export interface SessionsSyncNotificationProps {
  jobId: string
  message: string
  onDone: () => void
  orgSlug: string
}

export function SessionsSyncNotification({
  jobId,
  message,
  onDone,
  orgSlug,
}: SessionsSyncNotificationProps) {
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

            await queryClient.invalidateQueries({
              queryKey: workspaceSessionsQueryOptions(orgSlug).queryKey,
            })

            if (status.status === "failed") {
              toast.error("Session sync failed", {
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
  }, [jobId, onDone, orgSlug, queryClient])

  if (!visible) {
    return null
  }

  return <IntegrationFloatingStatusChip message={message} />
}
