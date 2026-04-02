import Link from "next/link";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRuntimeStatusLabel, getSlackStatusLabel } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Settings / Workspace</p>
        <h1 className="text-3xl font-semibold">Workspace settings</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Review the basics your team sees and jump into the areas that need
          attention.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workspace details</CardTitle>
            <CardDescription>
              The basic information attached to this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>Name: {organization.name}</p>
            <p>Workspace URL: /{organization.slug}</p>
            <p>Your access: {organization.role}</p>
            <div className="flex flex-wrap gap-2">
              <Link
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href={`/${organization.slug}/settings/workspace/members`}
              >
                Manage members
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workspace health</CardTitle>
            <CardDescription>
              A quick view of the connections Otto depends on.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>Slack: {getSlackStatusLabel(organization)}</p>
            <p>Otto: {getRuntimeStatusLabel(organization)}</p>
            <div className="flex flex-wrap gap-2">
              <Link
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href={`/${organization.slug}/integrations/slack`}
              >
                Open Slack
              </Link>
              <Link
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href={`/${organization.slug}/agent/prompts`}
              >
                Open Otto instructions
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
