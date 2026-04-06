import {
  SettingsCard,
  SettingsPage,
  SettingsRow,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import {
  formatStatus,
  formatTimestamp,
  getPlatformOrganizationDateTimePreferences,
  getRuntimeImageHref,
  loadPlatformOrganizationDetailRouteContext,
} from "@/app/platform/organizations/[orgSlug]/_lib/platform-organization-detail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

function OverviewValue({ value }: { value: string | React.ReactNode }) {
  return <div className="text-sm text-foreground">{value}</div>;
}

function OverviewRow({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <SettingsRow>
      <SettingsRowLabel>
        <SettingsRowTitle>{label}</SettingsRowTitle>
      </SettingsRowLabel>
      <OverviewValue value={value} />
    </SettingsRow>
  );
}

function isFailureStatus(status: string | null | undefined) {
  return (
    status === "failed" ||
    status === "error" ||
    status === "apply_failed" ||
    status === "link_failed"
  );
}

function isInProgressStatus(status: string | null | undefined) {
  return (
    status === "queued" ||
    status === "running" ||
    status === "pending_apply" ||
    status === "loading_desired_state" ||
    status === "rendering_files" ||
    status === "writing_files" ||
    status === "pulling_runtime_image" ||
    status === "restarting_runtime" ||
    status === "verifying_runtime" ||
    status === "applying" ||
    status === "provisioning"
  );
}

function getLatestIssueTitle(input: {
  latestApplyRunStatus?: string | null;
  latestJobStatus?: string | null;
  slackError?: string | null;
}) {
  if (
    input.latestApplyRunStatus &&
    isFailureStatus(input.latestApplyRunStatus)
  ) {
    return "Latest apply needs attention";
  }

  if (input.latestJobStatus && isFailureStatus(input.latestJobStatus)) {
    return "Latest job needs attention";
  }

  if (input.slackError) {
    return "Slack integration needs attention";
  }

  return "Latest issue";
}

export default async function PlatformOrganizationOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization } =
    await loadPlatformOrganizationDetailRouteContext(orgSlug);
  const dateTimePreferences =
    getPlatformOrganizationDateTimePreferences(organization);
  const tenant = organization.tenant;
  const latestApplyRun = tenant?.latestApplyRun ?? null;
  const latestJob = tenant?.recentJobs[0] ?? null;
  const latestFailureMessage =
    latestApplyRun?.error ??
    latestJob?.error ??
    organization.slackIntegration?.lastError;
  const observedRuntimeImageHref = organization.observedRuntimeImage
    ? getRuntimeImageHref(organization.observedRuntimeImage)
    : null;
  const configuredRuntimeImageHref = getRuntimeImageHref(
    organization.configuredRuntimeImage,
  );
  const hasFailure =
    isFailureStatus(latestApplyRun?.status) ||
    isFailureStatus(latestJob?.status) ||
    Boolean(organization.slackIntegration?.lastError);
  const isUpdating =
    isInProgressStatus(latestApplyRun?.status) ||
    isInProgressStatus(latestJob?.status);
  const runtimeReady =
    tenant?.status === "ready" && tenant?.serverStatus === "ready";
  const healthLabel = hasFailure
    ? "Needs attention"
    : isUpdating
      ? "Updating"
      : runtimeReady
        ? "Healthy"
        : "Provisioning";
  const healthVariant = hasFailure
    ? "destructive"
    : runtimeReady
      ? "secondary"
      : "outline";
  const latestFailure =
    latestFailureMessage ??
    (isFailureStatus(latestApplyRun?.status)
      ? `Latest apply is ${formatStatus(latestApplyRun?.status ?? null)}.`
      : isFailureStatus(latestJob?.status)
        ? `Latest job is ${formatStatus(latestJob?.status ?? null)}.`
        : null);
  const latestIssueTitle = getLatestIssueTitle({
    latestApplyRunStatus: latestApplyRun?.status,
    latestJobStatus: latestJob?.status,
    slackError: organization.slackIntegration?.lastError,
  });

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
    );
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
                    ? `${formatStatus(latestApplyRun.status)} · ${formatTimestamp(
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
                    ? `${formatStatus(latestJob.status)} · ${formatTimestamp(
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
                    (organization.observedRuntimeImageVersion ??
                    organization.observedRuntimeImage ??
                    "Not available")
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
                    (organization.configuredRuntimeImageVersion ??
                    organization.configuredRuntimeImage)
                  )
                }
              />
              <OverviewRow
                label="Slack workspace"
                value={
                  organization.slackIntegration?.teamName ?? "Not connected"
                }
              />
            </SettingsCard>
          </SettingsSection>
        </div>
      </SettingsPage>
    </div>
  );
}
