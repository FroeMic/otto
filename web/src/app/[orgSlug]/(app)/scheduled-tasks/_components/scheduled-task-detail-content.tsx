import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { Textarea } from "@/components/ui/textarea";
import type { WorkspaceDateTimePreferences } from "@/lib/date-time";
import { describeScheduledTaskSchedule } from "@/lib/scheduled-tasks/cron-description";

type ScheduledTaskDetailTask = {
  agentId: string | null;
  deleteAfterRun: boolean;
  deliveryJson: Record<string, unknown> | null;
  failureAlertJson: Record<string, unknown> | null;
  payloadJson: Record<string, unknown> | null;
  scheduleExpression: string;
  scheduleJson: Record<string, unknown> | null;
  sessionKey: string | null;
  sessionTarget: string | null;
  timezone: string | null;
  wakeMode: string | null;
};

const lockedTextareaClassName = [
  "min-h-56 rounded-xl border-border bg-muted/40 font-mono text-xs leading-5 md:text-xs",
  "disabled:cursor-default disabled:opacity-100 disabled:border-border disabled:bg-muted/20 disabled:text-foreground",
].join(" ");

export function ScheduledTaskOverviewContent({
  dateTimePreferences,
  task,
}: {
  dateTimePreferences: WorkspaceDateTimePreferences;
  task: ScheduledTaskDetailTask;
}) {
  const prompt = readTaskPrompt(task.payloadJson);
  const scheduleDescription = describeScheduledTaskSchedule({
    dateTimePreferences,
    scheduleExpression: task.scheduleExpression,
    scheduleJson: task.scheduleJson,
    timezone: task.timezone,
  });

  return (
    <SettingsPage className="mx-0 max-w-none">
      <div className="flex flex-col gap-8 pb-8">
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
          <LockedTextarea
            value={prompt ?? "No prompt text was captured for this task."}
          />
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}

export function ScheduledTaskConfigurationContent({
  dateTimePreferences,
  task,
}: {
  dateTimePreferences: WorkspaceDateTimePreferences;
  task: ScheduledTaskDetailTask;
}) {
  const scheduleDescription = describeScheduledTaskSchedule({
    dateTimePreferences,
    scheduleExpression: task.scheduleExpression,
    scheduleJson: task.scheduleJson,
    timezone: task.timezone,
  });
  const payloadConfig = buildPayloadConfig(task.payloadJson);
  const deliveryConfig = stringifyConfig(task.deliveryJson);
  const failureAlertConfig = stringifyConfig(task.failureAlertJson);

  return (
    <SettingsPage className="mx-0 max-w-none">
      <div className="flex flex-col gap-8 pb-8">
        <SettingsSection>
          <SettingsSectionTitle>Configuration</SettingsSectionTitle>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Schedule</SettingsRowTitle>
              </SettingsRowLabel>
              <div className="max-w-xl text-right text-sm text-muted-foreground">
                <div>{scheduleDescription}</div>
                <div className="truncate">{task.scheduleExpression}</div>
              </div>
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Runtime target</SettingsRowTitle>
                <SettingsRowDescription>
                  Where the task runs and how it wakes the runtime.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <div className="max-w-xl text-right text-sm text-muted-foreground">
                <div>{task.sessionTarget ?? "-"}</div>
                <div>{task.wakeMode ?? "-"}</div>
              </div>
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Bound context</SettingsRowTitle>
                <SettingsRowDescription>
                  Agent and session bindings captured from the runtime.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <div className="max-w-xl text-right text-sm text-muted-foreground">
                <div>{task.agentId ?? "-"}</div>
                <div>{task.sessionKey ?? "-"}</div>
              </div>
            </SettingsRow>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Execution flags</SettingsRowTitle>
                <SettingsRowDescription>
                  Extra runtime behavior for this task.
                </SettingsRowDescription>
              </SettingsRowLabel>
              <div className="max-w-xl text-right text-sm text-muted-foreground">
                {task.deleteAfterRun ? "Delete after run" : "Keep after run"}
              </div>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <ReadOnlyConfigBlock
          description="Structured execution config for the task payload."
          title="Payload Config"
          value={payloadConfig ?? "No additional payload config."}
        />
        <ReadOnlyConfigBlock
          description="How task output is delivered after the run completes."
          title="Delivery Config"
          value={deliveryConfig ?? "No delivery config."}
        />
        <ReadOnlyConfigBlock
          description="Alerting configuration used when repeated failures happen."
          title="Failure Alerts"
          value={failureAlertConfig ?? "No failure alert config."}
        />
      </div>
    </SettingsPage>
  );
}

function ReadOnlyConfigBlock({
  description,
  title,
  value,
}: {
  description: string;
  title: string;
  value: string;
}) {
  return (
    <SettingsSection>
      <SettingsSectionTitle>{title}</SettingsSectionTitle>
      <SettingsSectionDescription>{description}</SettingsSectionDescription>
      <LockedTextarea value={value} />
    </SettingsSection>
  );
}

function LockedTextarea({ value }: { value: string }) {
  return (
    <Textarea
      className={lockedTextareaClassName}
      defaultValue={value}
      disabled
      readOnly
    />
  );
}

function readTaskPrompt(payload: Record<string, unknown> | null) {
  if (!payload || typeof payload.kind !== "string") {
    return null;
  }

  if (payload.kind === "agentTurn" && typeof payload.message === "string") {
    return payload.message;
  }

  if (payload.kind === "systemEvent" && typeof payload.text === "string") {
    return payload.text;
  }

  return null;
}

function buildPayloadConfig(payload: Record<string, unknown> | null) {
  if (!payload) {
    return null;
  }

  const nextPayload = { ...payload };
  delete nextPayload.message;
  delete nextPayload.text;

  if (Object.keys(nextPayload).length === 0) {
    return null;
  }

  return stringifyConfig(nextPayload);
}

function stringifyConfig(value: Record<string, unknown> | null) {
  if (!value) {
    return null;
  }

  return JSON.stringify(value, null, 2);
}
