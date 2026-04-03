import Link from "next/link";

import {
  formatStatus,
  formatTimestamp,
  getRuntimeImageHref,
  getStatusVariant,
  loadPlatformOrganizationDetailRouteContext,
} from "@/app/platform/organizations/[orgSlug]/_lib/platform-organization-detail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

function StateValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
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
    <div className="grid gap-4 px-4 pb-6 md:px-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Current state</CardTitle>
          <CardDescription>
            The most important persisted state for this workspace and runtime.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <StateValue label="Tenant" value={tenant.name} />
          <StateValue label="Server IP" value={tenant.ipv4 ?? "Pending"} />
          <StateValue
            label="Desired state"
            value={
              tenant.latestDesiredStateVersion
                ? `v${tenant.latestDesiredStateVersion}`
                : "Not available"
            }
          />
          <StateValue
            label="Slack workspace"
            value={organization.slackIntegration?.teamName ?? "Not connected"}
          />
          <StateValue
            label="Latest apply"
            value={
              latestApplyRun
                ? `${formatStatus(latestApplyRun.status)} · v${latestApplyRun.desiredStateVersion}`
                : "No apply recorded"
            }
          />
          <StateValue
            label="Latest job"
            value={
              latestJob
                ? `${formatStatus(latestJob.jobType)} · ${formatStatus(latestJob.status)}`
                : "No job recorded"
            }
          />
          <StateValue
            label="Latest apply time"
            value={formatTimestamp(
              latestApplyRun?.finishedAt ?? latestApplyRun?.startedAt ?? null,
            )}
          />
          <StateValue
            label="Latest job time"
            value={formatTimestamp(
              latestJob?.finishedAt ??
                latestJob?.startedAt ??
                latestJob?.createdAt ??
                null,
            )}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Operator summary</CardTitle>
            <CardDescription>
              The shortest path to what changed and where to look next.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {latestFailure ? (
              <Alert variant="destructive">
                <AlertTitle>Needs attention</AlertTitle>
                <AlertDescription>{latestFailure}</AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTitle>No active error recorded</AlertTitle>
                <AlertDescription>
                  The latest stored apply and job state do not currently show a
                  blocking failure.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Runtime image
                </span>
                {runtimeImageHref ? (
                  <Link
                    className="text-sm underline-offset-4 hover:underline"
                    href={runtimeImageHref}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {organization.runtimeImageVersion ??
                      organization.runtimeImage}
                  </Link>
                ) : (
                  <span className="text-sm text-foreground">
                    {organization.runtimeImageVersion ??
                      organization.runtimeImage}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Runtime status
                </span>
                <Badge
                  variant={getStatusVariant(
                    tenant.status ?? tenant.serverStatus ?? null,
                  )}
                >
                  {formatStatus(tenant.status)} /{" "}
                  {formatStatus(tenant.serverStatus)}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Next place to inspect
                </span>
                <Link
                  className="text-sm underline-offset-4 hover:underline"
                  href={`/platform/organizations/${organization.slug}/activity`}
                >
                  Open activity
                </Link>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Runtime access
                </span>
                <Link
                  className="text-sm underline-offset-4 hover:underline"
                  href={`/platform/organizations/${organization.slug}/access`}
                >
                  Open access
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
