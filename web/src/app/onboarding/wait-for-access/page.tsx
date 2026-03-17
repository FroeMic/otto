import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardOrganizations } from "@/db/control-plane";
import { getOrganizationHomePath, isOrganizationReady } from "@/lib/workspace";

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

  const readyOrganization = organizations.find((organization) =>
    isOrganizationReady(organization),
  );

  if (readyOrganization) {
    redirect(getOrganizationHomePath(readyOrganization));
  }

  const organization =
    organizations.find((item) => item.slug === orgSlug) ?? organizations[0];

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs tracking-[0.18em] uppercase text-muted-foreground">
                Workspace access
              </p>
              <CardTitle>We&apos;re reviewing {organization.name}</CardTitle>
              <CardDescription>
                Your workspace has been created, but Otto is still locked until
                we mark this organization as ready internally.
              </CardDescription>
            </div>
            <Link
              className={buttonVariants({ size: "sm", variant: "ghost" })}
              href="/auth/sign-out"
            >
              Log out
            </Link>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
          <p>
            Once {organization.name} is approved, the Slack connection step,
            provisioning flow, and the main workspace UI will unlock
            automatically.
          </p>
          <p>
            Otto link:{" "}
            <span className="font-medium text-foreground">
              /{organization.slug}
            </span>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
