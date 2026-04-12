import { WarningCircleIcon } from "@phosphor-icons/react"
import type { PropsWithChildren } from "react"

import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageTitle,
  SettingsSectionDescription,
} from "@/client/app/app-shell/SettingsLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import type { WorkspaceDateTimePreferences } from "@/features/workspace/date-time"

import { formatShortDateTime } from "../lib/date-time"
import type {
  ScheduledTasksSyncState,
  WorkspaceScheduledTasksSection,
} from "../types"
import { ScheduledTasksActionsMenu } from "./ScheduledTasksActionsMenu"
import { ScheduledTasksTabs } from "./ScheduledTasksTabs"

export interface ScheduledTasksShellProps extends PropsWithChildren {
  currentSection: WorkspaceScheduledTasksSection
  dateTimePreferences: WorkspaceDateTimePreferences
  hideHeader?: boolean
  lastSyncedAt: string | null
  orgSlug: string
  showTabs?: boolean
  syncState: ScheduledTasksSyncState
}

export function ScheduledTasksShell({
  children,
  currentSection,
  dateTimePreferences,
  hideHeader = false,
  lastSyncedAt,
  orgSlug,
  showTabs = true,
  syncState,
}: ScheduledTasksShellProps) {
  return (
    <SettingsPage>
      <SettingsPageContent className="flex max-w-6xl flex-col gap-6 pb-8">
        {!hideHeader ? (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <SettingsPageTitle>Scheduled Tasks</SettingsPageTitle>
                    <Badge variant={syncState.variant}>{syncState.label}</Badge>
                  </div>
                  <SettingsSectionDescription className="max-w-3xl leading-6">
                    View the current scheduled work in this workspace and pull
                    the latest runtime state on demand.
                  </SettingsSectionDescription>
                  <p className="text-xs text-muted-foreground">
                    {lastSyncedAt
                      ? `Last synced ${formatShortDateTime(
                          new Date(lastSyncedAt),
                          dateTimePreferences,
                        )}`
                      : "No runtime data imported yet."}
                  </p>
                </div>
                <ScheduledTasksActionsMenu orgSlug={orgSlug} />
              </div>

              {showTabs ? (
                <ScheduledTasksTabs
                  currentSection={currentSection}
                  orgSlug={orgSlug}
                />
              ) : null}
            </div>

            {syncState.variant === "destructive" && syncState.message ? (
              <Alert variant="destructive">
                <WarningCircleIcon className="size-4" />
                <AlertTitle>{syncState.label}</AlertTitle>
                <AlertDescription>{syncState.message}</AlertDescription>
              </Alert>
            ) : null}
          </>
        ) : null}

        {children}
      </SettingsPageContent>
    </SettingsPage>
  )
}
