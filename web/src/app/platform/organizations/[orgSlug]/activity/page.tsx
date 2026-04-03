import { PlatformActivityToolbar } from "@/app/platform/organizations/[orgSlug]/_components/platform-activity-toolbar";
import {
  formatStatus,
  formatTimestamp,
  getStatusVariant,
  loadPlatformOrganizationDetailRouteContext,
} from "@/app/platform/organizations/[orgSlug]/_lib/platform-organization-detail";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ActivitySearchParams = {
  type?: string;
  view?: string;
};

export default async function PlatformOrganizationActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<ActivitySearchParams>;
}) {
  const [{ orgSlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const { organization } =
    await loadPlatformOrganizationDetailRouteContext(orgSlug);
  const tenant = organization.tenant;
  const view = resolvedSearchParams.view === "events" ? "events" : "jobs";
  const type = resolvedSearchParams.type === "apply" ? "apply" : "all";

  if (!tenant) {
    return (
      <div className="px-4 pb-6 md:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No activity yet</EmptyTitle>
            <EmptyDescription>
              This organization does not have a tenant runtime yet, so there is
              no background activity to inspect.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const jobRows =
    type === "apply"
      ? tenant.recentJobs.filter((job) => job.jobType === "apply_tenant_config")
      : tenant.recentJobs;
  const eventRows =
    type === "apply"
      ? tenant.recentEvents.filter(
          (event) => event.jobType === "apply_tenant_config",
        )
      : tenant.recentEvents;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 md:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Reverse chronological workflow activity for this workspace. Switch
            between jobs and events, or narrow jobs to config-apply runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PlatformActivityToolbar orgSlug={organization.slug} />
          {view === "jobs" ? (
            jobRows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Finished</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobRows.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>{formatStatus(job.jobType)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(job.status)}>
                          {formatStatus(job.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatStatus(job.step)}</TableCell>
                      <TableCell>{job.attempt + 1}</TableCell>
                      <TableCell>
                        {formatTimestamp(job.startedAt ?? job.createdAt)}
                      </TableCell>
                      <TableCell>{formatTimestamp(job.finishedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty className="min-h-0 p-8">
                <EmptyHeader>
                  <EmptyTitle>No matching jobs</EmptyTitle>
                  <EmptyDescription>
                    No jobs matched the current activity filter.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          ) : eventRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Job type</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventRows.map((event) => (
                  <TableRow
                    key={`${event.jobRunId}-${event.eventType}-${event.createdAt.toISOString()}`}
                  >
                    <TableCell>{formatTimestamp(event.createdAt)}</TableCell>
                    <TableCell>{formatStatus(event.jobType)}</TableCell>
                    <TableCell>{formatStatus(event.eventType)}</TableCell>
                    <TableCell>{event.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty className="min-h-0 p-8">
              <EmptyHeader>
                <EmptyTitle>No matching events</EmptyTitle>
                <EmptyDescription>
                  No events matched the current activity filter.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
