import { PlatformUsageContent } from "@/app/platform/organizations/[orgSlug]/_components/platform-usage-content";
import { loadPlatformOrganizationDetailRouteContext } from "@/app/platform/organizations/[orgSlug]/_lib/platform-organization-detail";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default async function PlatformOrganizationUsagePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization } =
    await loadPlatformOrganizationDetailRouteContext(orgSlug);
  const tenant = organization.tenant;

  if (!tenant) {
    return (
      <div className="px-4 pb-6 md:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No tenant provisioned yet</EmptyTitle>
            <EmptyDescription>
              This organization does not have a tenant runtime yet, so there is
              no provider usage to inspect.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (!tenant.openAiProvider?.projectId) {
    return (
      <div className="px-4 pb-6 md:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No OpenAI provider configured yet</EmptyTitle>
            <EmptyDescription>
              Provision an OpenAI project for this workspace first, then usage
              data will appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <PlatformUsageContent
      locale={organization.locale}
      orgSlug={orgSlug}
      timezone={organization.timezone}
    />
  );
}
