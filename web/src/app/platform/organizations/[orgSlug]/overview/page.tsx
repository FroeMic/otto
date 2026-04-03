import {
  SettingsCard,
  SettingsPage,
  SettingsSection,
  SettingsSectionTitle,
  SettingsRow,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import {
  formatStatus,
  formatTimestamp,
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

export default async function PlatformOrganizationOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization } =
    await loadPlatformOrganizationDetailRouteContext(orgSlug);
  const tenant = organization.tenant;
  const latestApplyRun = tenant?.latestApplyRun ?? null;
  const latestJob = tenant?.recentJobs[0] ?? null;
  const latestFailure =
    latestApplyRun?.error ??
    latestJob?.error ??
    organization.slackIntegration?.lastError;
  const runtimeImageHref = getRuntimeImageHref(organization.runtimeImage);
  const healthLabel = latestFailure
    ? "Needs attention"
    : tenant?.status === "ready" && tenant?.serverStatus === "ready"
      ? "Healthy"
      : "Provisioning";
  const healthVariant = latestFailure
    ? "destructive"
    : tenant?.status === "ready" && tenant?.serverStatus === "ready"
      ? "secondary"
      : "outline";

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
                      )}`
                    : "No job recorded"
                }
              />
            </SettingsCard>
            {latestFailure ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{latestFailure}</AlertDescription>
              </Alert>
            ) : null}
          </SettingsSection>

          <SettingsSection>
            <SettingsSectionTitle>Current</SettingsSectionTitle>
            <SettingsCard>
              <OverviewRow label="Server IP" value={tenant.ipv4 ?? "Pending"} />
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
                  runtimeImageHref ? (
                    <a
                      className="underline-offset-4 hover:underline"
                      href={runtimeImageHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {organization.runtimeImageVersion ??
                        organization.runtimeImage}
                    </a>
                  ) : (
                    (organization.runtimeImageVersion ?? organization.runtimeImage)
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
