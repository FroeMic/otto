import { useSuspenseQuery } from "@tanstack/react-query"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { shellBootstrapQueryOptions } from "@/features/workspace/api/workspace"

import { workspaceSessionsQueryOptions } from "../api/sessions"
import { SessionsActionsMenu } from "../components/SessionsActionsMenu"
import { SessionsTable } from "../components/SessionsTable"

export interface SessionsPageProps {
  orgSlug: string
}

export function SessionsPage({ orgSlug }: SessionsPageProps) {
  const { data } = useSuspenseQuery(workspaceSessionsQueryOptions(orgSlug))
  const { data: shell } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))

  if (data.state === "pending_setup") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Historic Otto sessions synced from the tenant runtime.
          </p>
        </div>
        <Alert>
          <AlertTitle>No Otto runtime yet</AlertTitle>
          <AlertDescription>
            Sessions will appear here once Otto has been provisioned for this
            workspace.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Agent conversation sessions synced from the runtime.{" "}
            <span className="font-medium text-foreground">
              {data.sessions.length}
            </span>{" "}
            sessions.
          </p>
        </div>
        <SessionsActionsMenu orgSlug={orgSlug} />
      </div>

      <SessionsTable
        channelNames={data.channelNames}
        cronTaskKeys={data.cronTaskKeys}
        currentUserExternalIds={data.currentUserExternalIds}
        dateTimePreferences={data.dateTimePreferences}
        isPlatformAdmin={shell.user.isPlatformAdmin}
        memberNames={data.memberNames}
        orgSlug={orgSlug}
        sessions={data.sessions}
      />
    </div>
  )
}
