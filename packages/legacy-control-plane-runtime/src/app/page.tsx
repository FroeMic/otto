import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

import { getDashboardOrganizations } from "../db/control-plane";
import { hasWorkOSConfig } from "../lib/workos";
import { getOrganizationHomePath, isOrganizationReady } from "../lib/workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
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

  if (!auth.user) {
    redirect("/login");
  }

  const organizations = await getDashboardOrganizations(auth.user.id);

  if (organizations.length === 0) {
    redirect("/onboarding/create-organization");
  }

  const readyOrganization =
    organizations.find((organization) => isOrganizationReady(organization)) ??
    organizations[0];

  redirect(getOrganizationHomePath(readyOrganization));
}
