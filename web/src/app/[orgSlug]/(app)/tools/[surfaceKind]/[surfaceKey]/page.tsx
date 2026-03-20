import { notFound, redirect } from "next/navigation";
import type { ComponentType } from "react";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTenantToolConfigSurface } from "@/db/control-plane";
import { isOrganizationUnlocked } from "@/lib/workspace";
import { getToolDefinition } from "@/tools";
import type { ToolSurfacePageProps, ToolSurfaceResponse } from "@/tools/types";

export const dynamic = "force-dynamic";

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{
    orgSlug: string;
    surfaceKey: string;
    surfaceKind: string;
  }>;
}) {
  const { orgSlug, surfaceKey, surfaceKind } = await params;
  const { currentOrganization: organization, user } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  if (surfaceKind === "channel" && surfaceKey === "slack") {
    redirect(`/${organization.slug}/integrations/slack`);
  }

  const [surface, definition] = await Promise.all([
    getTenantToolConfigSurface({
      orgSlug,
      surfaceKey,
      surfaceKind,
      userExternalId: user.id,
    }),
    Promise.resolve(getToolDefinition(surfaceKind, surfaceKey)),
  ]);

  if (!surface || !definition) {
    notFound();
  }

  if (definition.renderPage) {
    const RenderPage = definition.renderPage as ComponentType<
      ToolSurfacePageProps<Record<string, unknown>, Record<string, unknown>>
    >;

    return (
      <RenderPage
        orgSlug={organization.slug}
        surface={
          surface as ToolSurfaceResponse<
            Record<string, unknown>,
            Record<string, unknown>
          >
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{surface.label}</CardTitle>
        <CardDescription>{surface.description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        This tool does not provide a dedicated detail page yet.
      </CardContent>
    </Card>
  );
}
