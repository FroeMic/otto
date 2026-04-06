import { withAuth } from "@workos-inc/authkit-nextjs";
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
import { getOrganizationHomePath, isOrganizationReady } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspaceWaitingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  if (isOrganizationReady(organization)) {
    redirect(getOrganizationHomePath(organization));
  }

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
                Your workspace exists, but Otto is not available in this
                workspace yet. We&apos;ll unlock setup here as soon as this
                workspace is activated.
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
            You&apos;re still in the{" "}
            <span className="font-medium text-foreground">
              {organization.name}
            </span>{" "}
            workspace. Once it is activated, Slack setup, provisioning, and the
            full workspace will open here automatically.
          </p>
          <p>
            Workspace URL:{" "}
            <span className="font-medium text-foreground">
              /{organization.slug}
            </span>
          </p>
          <p>
            Signed in as{" "}
            <span className="font-medium text-foreground">{user.email}</span>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
