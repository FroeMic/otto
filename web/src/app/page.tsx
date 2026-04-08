import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

import { getDashboardOrganizations } from "@/db/control-plane";
import { hasWorkOSConfig } from "@/lib/workos";
import { getOrganizationHomePath, isOrganizationReady } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const startedAt = Date.now();
  console.info("[home] request start");
  if (!hasWorkOSConfig()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl border bg-card p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Otto
          </p>
          <h1 className="mt-4 text-3xl font-semibold">
            Sign-in still needs to be set up.
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Once sign-in is ready, this is where teams set up their workspace,
            connect Slack, and manage Otto.
          </p>
        </div>
      </div>
    );
  }

  const auth = await withAuth();
  console.info("[home] withAuth complete", {
    durationMs: Date.now() - startedAt,
    hasUser: Boolean(auth.user),
  });

  if (!auth.user) {
    redirect("/login");
  }

  const organizations = await getDashboardOrganizations(auth.user.id);
  console.info("[home] getDashboardOrganizations complete", {
    durationMs: Date.now() - startedAt,
    organizationCount: organizations.length,
    userExternalId: auth.user.id,
  });

  if (organizations.length === 0) {
    redirect("/onboarding/create-organization");
  }

  const readyOrganization =
    organizations.find((organization) => isOrganizationReady(organization)) ??
    organizations[0];

  console.info("[home] redirecting to organization", {
    durationMs: Date.now() - startedAt,
    targetOrgSlug: readyOrganization.slug,
    userExternalId: auth.user.id,
  });

  redirect(getOrganizationHomePath(readyOrganization));
}
