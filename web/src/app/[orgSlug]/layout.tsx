import { withAuth } from "@workos-inc/authkit-nextjs";
import { notFound, redirect } from "next/navigation";

import { OrganizationShell } from "@/components/organization-shell";
import { getDashboardOrganizations } from "@/db/control-plane";
import { getPendingAccessPath, isOrganizationReady } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug } = await params;
  const organizations = await getDashboardOrganizations(user.id);

  if (organizations.length === 0) {
    redirect("/onboarding/create-organization");
  }

  const currentOrganization = organizations.find(
    (organization) => organization.slug === orgSlug,
  );

  if (!currentOrganization) {
    notFound();
  }

  if (!isOrganizationReady(currentOrganization)) {
    redirect(getPendingAccessPath(currentOrganization.slug));
  }

  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <OrganizationShell
      currentOrganization={currentOrganization}
      organizations={organizations.map((organization) => ({
        name: organization.name,
        slug: organization.slug,
      }))}
      user={{
        email: user.email,
        name: userName,
      }}
    >
      {children}
    </OrganizationShell>
  );
}
