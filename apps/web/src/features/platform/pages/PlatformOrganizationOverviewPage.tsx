import { useSuspenseQuery } from "@tanstack/react-query"

import { platformOrganizationDetailQueryOptions } from "@/features/platform/api/platform"
import {
  formatPreciseDateTime,
  resolvePlatformDateTimePreferences,
} from "@/features/platform/date-time"
import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

function formatStatus(status: string | null) {
  if (!status) {
    return "Not available"
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getRuntimeImageHref(image: string) {
  if (!image.startsWith("ghcr.io/")) {
    return null
  }

  const [repository] = image.replace("ghcr.io/", "").split(":")
  const [owner, packageName] = repository.split("/")

  if (!owner || !packageName) {
    return null
  }

  return `https://github.com/orgs/${owner}/packages/container/package/${packageName}`
}

function isFailureStatus(status: string | null | undefined) {
  return (
    status === "apply_failed" ||
    status === "error" ||
    status === "failed" ||
    status === "link_failed"
  )
}

function isInProgressStatus(status: string | null | undefined) {
  return (
    status === "applying" ||
    status === "loading_desired_state" ||
    status === "pending_apply" ||
    status === "provisioning" ||
    status === "pulling_runtime_image" ||
    status === "queued" ||
    status === "rendering_files" ||
    status === "restarting_runtime" ||
    status === "running" ||
    status === "verifying_runtime" ||
    status === "writing_files"
  )
}

function getLatestIssueTitle(input: {
  latestFailureMessage?: string | null
  latestApplyRunStatus?: string | null
  latestJobStatus?: string | null
  slackError?: string | null
}) {
  if (
    input.latestApplyRunStatus &&
    isFailureStatus(input.latestApplyRunStatus)
  ) {
    return "Latest apply needs attention"
  }

  if (input.latestJobStatus && isFailureStatus(input.latestJobStatus)) {
    return "Latest job needs attention"
  }

  if (input.latestFailureMessage?.includes("Managed skill ")) {
    return "Managed skills need attention"
  }

  if (input.slackError) {
    return "Slack needs attention"
  }

  return "Latest issue"
}

function OverviewValue({ value }: { value: React.ReactNode }) {
  return <div className="text-sm text-foreground">{value}</div>
}

function OverviewRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <SettingsRow>
      <SettingsRowLabel>
        <SettingsRowTitle>{label}</SettingsRowTitle>
      </SettingsRowLabel>
      <OverviewValue value={value} />
    </SettingsRow>
  )
}

export interface PlatformOrganizationOverviewPageProps {
  orgSlug: string
}

export function PlatformOrganizationOverviewPage({
  orgSlug,
}: PlatformOrganizationOverviewPageProps) {
  const { data } = useSuspenseQuery(platformOrganizationDetailQueryOptions(orgSlug))
  const organization = data.organization
  const tenant = organization.tenant
  const dateTimePreferences = resolvePlatformDateTimePreferences({
    locale: organization.locale,
    timeFormatPreference: organization.timeFormatPreference,
    timeZone: organization.timezone,
  })
  const latestApplyRun = tenant?.latestApplyRun ?? null
  const latestJob = tenant?.recentJobs[0] ?? null
  const latestFailureMessage =
    latestApplyRun?.error ??
    latestJob?.error ??
    organization.slackIntegration?.lastError
  const observedRuntimeImageHref = organization.observedRuntimeImage
    ? getRuntimeImageHref(organization.observedRuntimeImage)
    : null
  const configuredRuntimeImageHref = organization.configuredRuntimeImage
    ? getRuntimeImageHref(organization.configuredRuntimeImage)
    : null
  const hasFailure =
    isFailureStatus(latestApplyRun?.status) ||
    isFailureStatus(latestJob?.status) ||
    Boolean(organization.slackIntegration?.lastError)
  const isUpdating =
    isInProgressStatus(latestApplyRun?.status) ||
    isInProgressStatus(latestJob?.status)
  const runtimeReady =
    tenant?.status === "ready" && tenant?.serverStatus === "ready"
  const healthLabel = hasFailure
    ? "Needs attention"
    : isUpdating
      ? "Updating"
      : runtimeReady
        ? "Healthy"
        : "Provisioning"
  const healthVariant = hasFailure
    ? "destructive"
    : runtimeReady
      ? "secondary"
      : "outline"
  const latestFailure =
    latestFailureMessage ??
    (isFailureStatus(latestApplyRun?.status)
      ? `Latest apply is ${formatStatus(latestApplyRun?.status ?? null)}.`
      : isFailureStatus(latestJob?.status)
        ? `Latest job is ${formatStatus(latestJob?.status ?? null)}.`
        : null)
  const latestIssueTitle = getLatestIssueTitle({
    latestFailureMessage,
    latestApplyRunStatus: latestApplyRun?.status,
    latestJobStatus: latestJob?.status,
    slackError: organization.slackIntegration?.lastError,
  })

  if (!tenant) {
    return (
      <div className="px-4 pb-6 md:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No tenant provisioned yet</EmptyTitle>
            <EmptyDescription>
              This organization does not have a tenant runtime yet, so only
              workspace-level state is currently available.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="px-4 pb-6 md:px-6">
      <SettingsPage className="mx-0 max-w-2xl">
        <div className="flex flex-col gap-10">
          <SettingsSection>
            <SettingsSectionTitle>Status</SettingsSectionTitle>
            <SettingsCard>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Health</SettingsRowTitle>
                </SettingsRowLabel>
                <Badge variant={healthVariant}>{healthLabel}</Badge>
              </SettingsRow>
              <OverviewRow
                label="Runtime"
                value={`${formatStatus(tenant.status)} / ${formatStatus(
                  tenant.serverStatus,
                )}`}
              />
              <OverviewRow
                label="Latest apply"
                value={
                  latestApplyRun
                    ? `${formatStatus(latestApplyRun.status)} · ${formatPreciseDateTime(
                        latestApplyRun.finishedAt ?? latestApplyRun.startedAt,
                        dateTimePreferences,
                      )}`
                    : "No apply recorded"
                }
              />
              <OverviewRow
                label="Latest job"
                value={
                  latestJob
                    ? `${formatStatus(latestJob.status)} · ${formatPreciseDateTime(
                        latestJob.finishedAt ??
                          latestJob.startedAt ??
                          latestJob.createdAt,
                        dateTimePreferences,
                      )}`
                    : "No job recorded"
                }
              />
            </SettingsCard>
            {latestFailure ? (
              <Alert className="rounded-lg" variant="destructive">
                <AlertTitle>{latestIssueTitle}</AlertTitle>
                <AlertDescription className="max-w-full overflow-hidden break-all">
                  {latestFailure}
                </AlertDescription>
              </Alert>
            ) : null}
          </SettingsSection>

          <SettingsSection>
            <SettingsSectionTitle>Current</SettingsSectionTitle>
            <SettingsCard>
              <OverviewRow label="Server IP" value={tenant.ipv4 ?? "Pending"} />
              <OverviewRow label="Timezone" value={organization.timezone} />
              <OverviewRow label="Locale" value={organization.locale} />
              <OverviewRow
                label="Time format"
                value={
                  organization.timeFormatPreference === "12"
                    ? "12-hour"
                    : organization.timeFormatPreference === "24"
                      ? "24-hour"
                      : "Automatic"
                }
              />
              <OverviewRow
                label="Desired state"
                value={
                  tenant.latestDesiredStateVersion
                    ? `v${tenant.latestDesiredStateVersion}`
                    : "Not available"
                }
              />
              <OverviewRow
                label="Runtime image"
                value={
                  observedRuntimeImageHref ? (
                    <a
                      className="text-foreground"
                      href={observedRuntimeImageHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {organization.observedRuntimeImageVersion ??
                        organization.observedRuntimeImage}
                    </a>
                  ) : (
                    organization.observedRuntimeImageVersion ??
                    organization.observedRuntimeImage ??
                    "Not available"
                  )
                }
              />
              <OverviewRow
                label="Configured image"
                value={
                  configuredRuntimeImageHref ? (
                    <a
                      className="text-foreground"
                      href={configuredRuntimeImageHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {organization.configuredRuntimeImageVersion ??
                        organization.configuredRuntimeImage}
                    </a>
                  ) : (
                    organization.configuredRuntimeImageVersion ??
                    organization.configuredRuntimeImage ??
                    "Not available"
                  )
                }
              />
              <OverviewRow
                label="Slack workspace"
                value={organization.slackIntegration?.teamName ?? "Not connected"}
              />
            </SettingsCard>
          </SettingsSection>
        </div>
      </SettingsPage>
    </div>
  )
}
