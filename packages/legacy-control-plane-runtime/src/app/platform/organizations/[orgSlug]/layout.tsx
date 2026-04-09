import { PlatformOrganizationActions } from "./_components/platform-organization-actions";
import { PlatformOrganizationTabs } from "./_components/platform-organization-tabs";
import { loadPlatformOrganizationDetailRouteContext } from "./_lib/platform-organization-detail";

export default async function PlatformOrganizationDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization, runtimeReady } =
    await loadPlatformOrganizationDetailRouteContext(orgSlug);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 pt-6">
      <div className="flex flex-col gap-4 px-4 md:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {organization.name}
            </h1>
          </div>
          <PlatformOrganizationActions
            hasTenant={Boolean(organization.tenant)}
            hasTenantOpenAiProvider={Boolean(
              organization.tenant?.openAiProvider,
            )}
            orgSlug={organization.slug}
            runtimeReady={runtimeReady}
          />
        </div>
        <PlatformOrganizationTabs orgSlug={organization.slug} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
