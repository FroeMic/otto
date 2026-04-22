import { useSuspenseQuery } from "@tanstack/react-query"
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { platformOrganizationDetailQueryOptions } from "@/features/platform/api/platform"
import {
  formatPreciseDateTime,
  resolvePlatformDateTimePreferences,
} from "@/features/platform/date-time"

function formatStatus(status: string | null) {
  if (!status) {
    return "Not available"
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getStatusVariant(status: string | null) {
  switch (status) {
    case "connected":
    case "ready":
    case "succeeded":
      return "secondary" as const
    case "failed":
    case "error":
    case "apply_failed":
      return "destructive" as const
    default:
      return "outline" as const
  }
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <SettingsRow>
      <SettingsRowLabel>
        <SettingsRowTitle>{label}</SettingsRowTitle>
      </SettingsRowLabel>
      <div className="text-sm text-foreground">{value}</div>
    </SettingsRow>
  )
}

function DiagnosticsBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium text-foreground">{label}</div>
      <pre className="overflow-x-auto rounded-3xl bg-muted px-4 py-3 font-mono text-xs leading-5 whitespace-pre-wrap text-foreground">
        {value}
      </pre>
    </div>
  )
}

export interface PlatformOrganizationLogsPageProps {
  orgSlug: string
}

export function PlatformOrganizationLogsPage({
  orgSlug,
}: PlatformOrganizationLogsPageProps) {
  const { data } = useSuspenseQuery(
    platformOrganizationDetailQueryOptions(orgSlug),
  )
  const organization = data.organization
  const dateTimePreferences = resolvePlatformDateTimePreferences({
    locale: organization.locale,
    timeFormatPreference: organization.timeFormatPreference,
    timeZone: organization.timezone,
  })

  if (!organization.tenant) {
    return (
      <div className="px-4 pb-6 md:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No tenant provisioned yet</EmptyTitle>
            <EmptyDescription>
              This organization does not have a tenant runtime yet, so logs are
              not available.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const tenant = organization.tenant
  const refreshJobs = tenant.recentJobs.filter(
    (job) =>
      job.jobType === "refresh_runtime_image" &&
      (job.error ||
        job.result?.restartStdout ||
        job.result?.restartStderr ||
        job.result?.verifyStdout ||
        job.result?.verifyStderr),
  )
  const applyRuns = tenant.recentApplyRuns.filter(
    (applyRun) =>
      applyRun.error ||
      applyRun.restartStdout ||
      applyRun.restartStderr ||
      applyRun.verifyStdout ||
      applyRun.verifyStderr,
  )

  return (
    <div className="px-4 pb-6 md:px-6">
      <SettingsPage className="mx-0 max-w-4xl">
        <div className="flex flex-col gap-10">
          <SettingsSection>
            <SettingsSectionTitle>Runtime image refresh</SettingsSectionTitle>
            <SettingsSectionDescription>
              Review the latest queued image refresh diagnostics and outcomes.
            </SettingsSectionDescription>
            {refreshJobs.length === 0 ? (
              <SettingsCard>
                <SettingsRow className="flex-col items-start gap-2">
                  <div className="text-sm font-medium text-foreground">
                    No image refresh runs
                  </div>
                  <div className="text-sm text-muted-foreground">
                    No runtime image refresh diagnostics have been recorded yet.
                  </div>
                </SettingsRow>
              </SettingsCard>
            ) : (
              <Accordion className="rounded-lg">
                {refreshJobs.map((job) => (
                  <AccordionItem key={job.id} value={job.id}>
                    <AccordionTrigger>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            Runtime image refresh
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatPreciseDateTime(
                              job.finishedAt ?? job.startedAt ?? job.createdAt,
                              dateTimePreferences,
                            )}
                          </div>
                        </div>
                        <Badge variant={getStatusVariant(job.status)}>
                          {formatStatus(job.status)}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-4">
                        <SettingsCard>
                          <MetadataRow label="Job ID" value={job.id} />
                          <MetadataRow
                            label="Started"
                            value={formatPreciseDateTime(
                              job.startedAt ?? job.createdAt,
                              dateTimePreferences,
                            )}
                          />
                          <MetadataRow
                            label="Finished"
                            value={formatPreciseDateTime(
                              job.finishedAt,
                              dateTimePreferences,
                            )}
                          />
                          {typeof job.result?.host === "string" ? (
                            <MetadataRow label="Host" value={job.result.host} />
                          ) : null}
                          {typeof job.result?.image === "string" ? (
                            <MetadataRow
                              label="Image"
                              value={job.result.image}
                            />
                          ) : null}
                          {job.error ? (
                            <MetadataRow label="Error" value={job.error} />
                          ) : null}
                        </SettingsCard>
                        {typeof job.result?.restartStdout === "string" ? (
                          <DiagnosticsBlock
                            label="Restart stdout"
                            value={job.result.restartStdout}
                          />
                        ) : null}
                        {typeof job.result?.restartStderr === "string" ? (
                          <DiagnosticsBlock
                            label="Restart stderr"
                            value={job.result.restartStderr}
                          />
                        ) : null}
                        {typeof job.result?.verifyStdout === "string" ? (
                          <DiagnosticsBlock
                            label="Health check stdout"
                            value={job.result.verifyStdout}
                          />
                        ) : null}
                        {typeof job.result?.verifyStderr === "string" ? (
                          <DiagnosticsBlock
                            label="Health check stderr"
                            value={job.result.verifyStderr}
                          />
                        ) : null}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </SettingsSection>

          <SettingsSection>
            <SettingsSectionTitle>
              Config apply diagnostics
            </SettingsSectionTitle>
            <SettingsSectionDescription>
              Review the most recent file-write and verification output from
              tenant config apply runs.
            </SettingsSectionDescription>
            {applyRuns.length === 0 ? (
              <SettingsCard>
                <SettingsRow className="flex-col items-start gap-2">
                  <div className="text-sm font-medium text-foreground">
                    No config apply runs
                  </div>
                  <div className="text-sm text-muted-foreground">
                    No apply diagnostics have been recorded yet.
                  </div>
                </SettingsRow>
              </SettingsCard>
            ) : (
              <Accordion className="rounded-lg">
                {applyRuns.map((applyRun) => (
                  <AccordionItem key={applyRun.id} value={applyRun.id}>
                    <AccordionTrigger>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            Desired state v{applyRun.desiredStateVersion}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatPreciseDateTime(
                              applyRun.finishedAt ??
                                applyRun.startedAt ??
                                applyRun.createdAt,
                              dateTimePreferences,
                            )}
                          </div>
                        </div>
                        <Badge variant={getStatusVariant(applyRun.status)}>
                          {formatStatus(applyRun.status)}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-4">
                        <SettingsCard>
                          <MetadataRow
                            label="Apply run ID"
                            value={applyRun.id}
                          />
                          <MetadataRow
                            label="Started"
                            value={formatPreciseDateTime(
                              applyRun.startedAt,
                              dateTimePreferences,
                            )}
                          />
                          <MetadataRow
                            label="Finished"
                            value={formatPreciseDateTime(
                              applyRun.finishedAt,
                              dateTimePreferences,
                            )}
                          />
                          {applyRun.error ? (
                            <MetadataRow label="Error" value={applyRun.error} />
                          ) : null}
                        </SettingsCard>
                        {applyRun.restartStdout ? (
                          <DiagnosticsBlock
                            label="Restart stdout"
                            value={applyRun.restartStdout}
                          />
                        ) : null}
                        {applyRun.restartStderr ? (
                          <DiagnosticsBlock
                            label="Restart stderr"
                            value={applyRun.restartStderr}
                          />
                        ) : null}
                        {applyRun.verifyStdout ? (
                          <DiagnosticsBlock
                            label="Health check stdout"
                            value={applyRun.verifyStdout}
                          />
                        ) : null}
                        {applyRun.verifyStderr ? (
                          <DiagnosticsBlock
                            label="Health check stderr"
                            value={applyRun.verifyStderr}
                          />
                        ) : null}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </SettingsSection>
        </div>
      </SettingsPage>
    </div>
  )
}
