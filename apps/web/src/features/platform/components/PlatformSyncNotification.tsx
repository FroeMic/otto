import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  fetchPlatformJobStatus,
  platformOrganizationDetailQueryOptions,
  platformOrganizationsQueryOptions,
} from "@/features/platform/api/platform"

import { FloatingStatusChip } from "./FloatingStatusChip"

const MIN_DISPLAY_MS = 10_000
const POLL_INTERVAL_MS = 1_000

export interface PlatformSyncNotificationProps {
  jobId: string
  message: string
  onDone: () => void
  orgSlug: string
}

export function PlatformSyncNotification({
  jobId,
  message,
  onDone,
  orgSlug,
}: PlatformSyncNotificationProps) {
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
        const status = await fetchPlatformJobStatus({
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
                queryKey: platformOrganizationDetailQueryOptions(orgSlug).queryKey,
              }),
              queryClient.invalidateQueries({
                queryKey: platformOrganizationsQueryOptions().queryKey,
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
        // Ignore transient polling errors and keep polling.
      }
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [jobId, onDone, orgSlug, queryClient])

  if (!visible) {
    return null
  }

  return <FloatingStatusChip message={message} />
}
