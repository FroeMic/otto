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
      <div className="text-sm text-foreground">{value}</div>
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

  const latestFailure =
    tenant.latestApplyRun?.error ??
    tenant.latestJob?.error ??
    organization.slackIntegration?.lastError
  const runtimeReady = tenant.status === "ready" && tenant.serverStatus === "ready"

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
                <Badge variant={runtimeReady ? "secondary" : "outline"}>
                  {runtimeReady ? "Healthy" : "Provisioning"}
                </Badge>
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
                  tenant.latestApplyRun
                    ? `${formatStatus(tenant.latestApplyRun.status)} · ${formatPreciseDateTime(
                        tenant.latestApplyRun.finishedAt ??
                          tenant.latestApplyRun.startedAt,
                        dateTimePreferences,
                      )}`
                    : "No apply recorded"
                }
              />
              <OverviewRow
                label="Latest job"
                value={
                  tenant.latestJob
                    ? `${formatStatus(tenant.latestJob.status)} · ${formatPreciseDateTime(
                        tenant.latestJob.finishedAt ??
                          tenant.latestJob.startedAt ??
                          tenant.latestJob.createdAt,
                        dateTimePreferences,
                      )}`
                    : "No job recorded"
                }
              />
            </SettingsCard>
            {latestFailure ? (
              <Alert className="rounded-lg" variant="destructive">
                <AlertTitle>Latest issue</AlertTitle>
                <AlertDescription className="max-w-full overflow-hidden break-all">
                  {latestFailure}
                </AlertDescription>
              </Alert>
            ) : null}
          </SettingsSection>

          <SettingsSection>
            <SettingsSectionTitle>Workspace</SettingsSectionTitle>
            <SettingsCard>
              <OverviewRow label="Workspace" value={organization.name} />
              <OverviewRow label="Slug" value={organization.slug} />
              <OverviewRow label="Tenant" value={tenant.name} />
              <OverviewRow
                label="Desired state"
                value={
                  tenant.latestDesiredStateVersion
                    ? `v${tenant.latestDesiredStateVersion}`
                    : "Not available"
                }
              />
            </SettingsCard>
          </SettingsSection>

          <SettingsSection>
            <SettingsSectionTitle>Runtime image</SettingsSectionTitle>
            <SettingsCard>
              <OverviewRow
                label="Configured"
                value={
                  organization.configuredRuntimeImage ? (
                    <a
                      href={
                        getRuntimeImageHref(organization.configuredRuntimeImage) ??
                        undefined
                      }
                      rel="noreferrer"
                      target="_blank"
                    >
                      {organization.configuredRuntimeImageVersion ??
                        organization.configuredRuntimeImage}
                    </a>
                  ) : (
                    "Not available"
                  )
                }
              />
              <OverviewRow
                label="Observed"
                value={
                  organization.observedRuntimeImage ? (
                    <a
                      href={
                        getRuntimeImageHref(organization.observedRuntimeImage) ??
                        undefined
                      }
                      rel="noreferrer"
                      target="_blank"
                    >
                      {organization.observedRuntimeImageVersion ??
                        organization.observedRuntimeImage}
                    </a>
                  ) : (
                    "Not available"
                  )
                }
              />
            </SettingsCard>
          </SettingsSection>

          <SettingsSection>
            <SettingsSectionTitle>Providers</SettingsSectionTitle>
            <SettingsCard>
              <OverviewRow
                label="Slack"
                value={
                  organization.slackIntegration?.teamName ?? "Not connected"
                }
              />
              <OverviewRow
                label="OpenAI"
                value={
                  tenant.openAiProvider?.projectId
                    ? `${tenant.openAiProvider.projectId} · ${formatStatus(
                        tenant.openAiProvider.status,
                      )}`
                    : "Not configured"
                }
              />
            </SettingsCard>
          </SettingsSection>
        </div>
      </SettingsPage>
    </div>
  )
}
