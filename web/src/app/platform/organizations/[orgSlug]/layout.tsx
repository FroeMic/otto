import Link from "next/link";

import { PlatformOrganizationActions } from "@/app/platform/organizations/[orgSlug]/_components/platform-organization-actions";
import { PlatformOrganizationTabs } from "@/app/platform/organizations/[orgSlug]/_components/platform-organization-tabs";
import {
  formatStatus,
  getStatusVariant,
  loadPlatformOrganizationDetailRouteContext,
} from "@/app/platform/organizations/[orgSlug]/_lib/platform-organization-detail";
import { Badge } from "@/components/ui/badge";

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
        <div>
          <Link
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/platform/organizations"
          >
            Organizations
          </Link>
        </div>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {organization.name}
              </h1>
              <Badge variant="outline">{organization.slug}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={organization.isReady ? "secondary" : "outline"}>
                Workspace {organization.isReady ? "enabled" : "restricted"}
              </Badge>
              <Badge
                variant={getStatusVariant(
                  organization.slackIntegration?.status ?? null,
                )}
              >
                Slack{" "}
                {formatStatus(organization.slackIntegration?.status ?? null)}
              </Badge>
              <Badge
                variant={getStatusVariant(
                  organization.tenant?.status ??
                    organization.tenant?.serverStatus ??
                    null,
                )}
              >
                Runtime{" "}
                {organization.tenant
                  ? `${formatStatus(organization.tenant.status)} / ${formatStatus(
                      organization.tenant.serverStatus,
                    )}`
                  : "Not provisioned"}
              </Badge>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Operator detail for this workspace runtime, access path, and
              recent background activity.
            </p>
          </div>
          <PlatformOrganizationActions
            hasTenant={Boolean(organization.tenant)}
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
