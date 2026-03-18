import Link from "next/link";
import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSlackStatusLabel, isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Integrations</p>
        <h1 className="text-3xl font-semibold">Connected tools</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Start with Slack, then connect more of the tools your team already
          uses.
        </p>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Slack</CardTitle>
          <CardDescription>
            Current state: {getSlackStatusLabel(organization)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            See whether Otto is connected to Slack and take care of any setup or
            repair steps.
          </p>
          <Link
            className={buttonVariants({ variant: "default" })}
            href={`/${organization.slug}/integrations/slack`}
          >
            Open Slack
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
