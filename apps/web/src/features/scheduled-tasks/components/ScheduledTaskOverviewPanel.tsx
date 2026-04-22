import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { Textarea } from "@/components/ui/textarea"
import type { WorkspaceDateTimePreferences } from "@/features/workspace/date-time"

import { describeScheduledTaskSchedule } from "../lib/cron-description"
import type { WorkspaceScheduledTaskDetail } from "../types"

const lockedTextareaClassName = [
  "min-h-56 rounded-xl border-border bg-muted/40 font-mono text-xs leading-5 md:text-xs",
  "disabled:cursor-default disabled:opacity-100 disabled:border-border disabled:bg-muted/20 disabled:text-foreground",
].join(" ")

export interface ScheduledTaskOverviewPanelProps {
  dateTimePreferences: WorkspaceDateTimePreferences
  task: WorkspaceScheduledTaskDetail
}

export function ScheduledTaskOverviewPanel({
  dateTimePreferences,
  task,
}: ScheduledTaskOverviewPanelProps) {
  const prompt = readTaskPrompt(task.payloadJson)
  const scheduleDescription = describeScheduledTaskSchedule({
    dateTimePreferences,
    scheduleExpression: task.scheduleExpression,
    scheduleJson: task.scheduleJson,
    timezone: task.timezone,
  })

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection>
        <SettingsSectionTitle>Schedule</SettingsSectionTitle>
        <SettingsCard>
          <SettingsRow>
            <SettingsRowLabel>
              <SettingsRowTitle>{scheduleDescription}</SettingsRowTitle>
              <SettingsRowDescription className="font-mono">
                {task.scheduleExpression}
              </SettingsRowDescription>
            </SettingsRowLabel>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection>
        <SettingsSectionTitle>Prompt</SettingsSectionTitle>
        <SettingsSectionDescription>
          The instruction or system-event text sent when the task runs.
        </SettingsSectionDescription>
        <Textarea
          className={lockedTextareaClassName}
          defaultValue={prompt ?? "No prompt text was captured for this task."}
          disabled
          readOnly
        />
      </SettingsSection>
    </div>
  )
}

function readTaskPrompt(payload: Record<string, unknown> | null) {
  if (!payload || typeof payload.kind !== "string") {
    return null
  }

  if (payload.kind === "agentTurn" && typeof payload.message === "string") {
    return payload.message
  }

  if (payload.kind === "systemEvent" && typeof payload.text === "string") {
    return payload.text
  }

  return null
}
