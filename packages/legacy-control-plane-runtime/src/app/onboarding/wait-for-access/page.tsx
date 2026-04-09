import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

import { buttonVariants } from "../../../components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { getDashboardOrganizations } from "../../../db/control-plane";
import { getOrganizationHomePath, isOrganizationReady } from "../../../lib/workspace";

export const dynamic = "force-dynamic";

export default async function WaitForAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orgSlug?: string }>;
}) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug } = await searchParams;
  const organizations = await getDashboardOrganizations(user.id);

  if (organizations.length === 0) {
    redirect("/onboarding/create-organization");
  }

  const requestedOrganization = orgSlug
    ? organizations.find((item) => item.slug === orgSlug)
    : null;

  if (requestedOrganization) {
    if (isOrganizationReady(requestedOrganization)) {
      redirect(getOrganizationHomePath(requestedOrganization));
    }
  } else {
    const readyOrganization = organizations.find((organization) =>
      isOrganizationReady(organization),
    );

    if (readyOrganization) {
      redirect(getOrganizationHomePath(readyOrganization));
    }
  }

  const organization = requestedOrganization ?? organizations[0];

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs tracking-[0.18em] uppercase text-muted-foreground">
                Access queue
              </p>
              <CardTitle>
                You&apos;re on the list for {organization.name}
              </CardTitle>
              <CardDescription>
                Your workspace is created. We&apos;ll open Otto for your team as
                soon as this workspace reaches the front of the queue.
              </CardDescription>
            </div>
            <a
              className={buttonVariants({ size: "sm", variant: "ghost" })}
              href="/auth/sign-out"
            >
              Log out
            </a>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
          <p>
            You don&apos;t need to do anything else right now. Once{" "}
            {organization.name} is activated, Slack setup, provisioning, and the
            full workspace will unlock automatically.
          </p>
          <p>
            Workspace URL:{" "}
            <span className="font-medium text-foreground">
              /{organization.slug}
            </span>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
