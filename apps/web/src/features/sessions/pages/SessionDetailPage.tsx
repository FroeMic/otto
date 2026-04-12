import { useSuspenseQuery } from "@tanstack/react-query"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { workspaceSessionDetailQueryOptions } from "../api/sessions"
import { TranscriptViewer } from "../components/TranscriptViewer"

export interface SessionDetailPageProps {
  orgSlug: string
  sessionKey: string
}

export function SessionDetailPage({
  orgSlug,
  sessionKey,
}: SessionDetailPageProps) {
  const { data } = useSuspenseQuery(
    workspaceSessionDetailQueryOptions({
      orgSlug,
      sessionKey,
    }),
  )

  if (data.state === "pending_setup" || !data.session) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <Alert>
          <AlertTitle>Runtime not ready</AlertTitle>
          <AlertDescription>
            This workspace does not have a ready Otto runtime yet, so session
            history is not available here.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <TranscriptViewer
      channelNames={data.channelNames}
      cronTaskHref={data.cronTaskHref}
      currentUserExternalIds={data.currentUserExternalIds}
      dateTimePreferences={data.dateTimePreferences}
      memberNames={data.memberNames}
      orgSlug={orgSlug}
      session={data.session}
    />
  )
}
