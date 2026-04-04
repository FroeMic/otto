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
import { describeScheduledTaskSchedule } from "@/lib/scheduled-tasks/cron-description";

const readOnlyTextareaClassName =
  "min-h-40 rounded-xl border-border bg-muted/40 font-mono text-xs leading-5";

export function ScheduledTaskSetupContent({
  task,
}: {
  task: {
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
}) {
  const scheduleDescription = describeScheduledTaskSchedule({
    scheduleExpression: task.scheduleExpression,
    scheduleJson: task.scheduleJson,
    timezone: task.timezone,
  });
  const prompt = readTaskPrompt(task.payloadJson);
  const payloadConfig = buildPayloadConfig(task.payloadJson);
  const deliveryConfig = stringifyConfig(task.deliveryJson);
  const failureAlertConfig = stringifyConfig(task.failureAlertJson);

  return (
    <SettingsPage className="mx-0 max-w-none">
      <div className="flex flex-col gap-8">
        <SettingsSection>
          <SettingsSectionTitle>Overview</SettingsSectionTitle>
          <SettingsSectionDescription>
            This is the runtime setup Otto has synced for this scheduled task.
          </SettingsSectionDescription>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>Schedule</SettingsRowTitle>
                <SettingsRowDescription>
                  Natural-language summary plus the raw schedule expression.
                </SettingsRowDescription>
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

        <SettingsSection>
          <SettingsSectionTitle>Prompt</SettingsSectionTitle>
          <SettingsSectionDescription>
            This is the instruction or system-event text sent when the task
            runs.
          </SettingsSectionDescription>
          <Textarea
            className={readOnlyTextareaClassName}
            defaultValue={
              prompt ?? "No prompt text was captured for this task."
            }
            readOnly
          />
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Setup</SettingsSectionTitle>
          <SettingsSectionDescription>
            Additional execution, delivery, and failure-alert configuration
            synced from the runtime.
          </SettingsSectionDescription>
          <div className="flex flex-col gap-6">
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
        </SettingsSection>
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Textarea
        className={readOnlyTextareaClassName}
        defaultValue={value}
        readOnly
      />
    </div>
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
