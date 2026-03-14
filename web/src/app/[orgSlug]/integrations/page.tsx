import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardOrganizations } from "@/db/control-plane";
import { getSlackStatusLabel, isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug } = await params;
  const organizations = await getDashboardOrganizations(user.id);
  const organization = organizations.find((item) => item.slug === orgSlug);

  if (!organization) {
    notFound();
  }

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
            See whether Otto is connected to Slack and finish setup if needed.
          </p>
          <Link
            className={buttonVariants({ variant: "default" })}
            href={`/${organization.slug}/integrations/slack`}
          >
            Open Slack integration
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
