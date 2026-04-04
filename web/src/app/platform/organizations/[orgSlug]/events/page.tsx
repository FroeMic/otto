import { PlatformActivityContent } from "@/app/platform/organizations/[orgSlug]/_components/platform-activity-content";
import { buildPlatformActivityData } from "@/app/platform/organizations/[orgSlug]/_lib/platform-activity-data";
import {
  getPlatformOrganizationDateTimePreferences,
  loadPlatformOrganizationDetailRouteContext,
} from "@/app/platform/organizations/[orgSlug]/_lib/platform-organization-detail";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default async function PlatformOrganizationEventsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization } =
    await loadPlatformOrganizationDetailRouteContext(orgSlug);
  const tenant = organization.tenant;
  const dateTimePreferences =
    getPlatformOrganizationDateTimePreferences(organization);

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

  const { events, jobs } = buildPlatformActivityData(
    tenant,
    dateTimePreferences,
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 px-4 pb-6 md:px-6">
      <PlatformActivityContent
        dateTimePreferences={dateTimePreferences}
        events={events}
        jobs={jobs}
        mode="events"
        orgSlug={organization.slug}
      />
    </div>
  );
}
