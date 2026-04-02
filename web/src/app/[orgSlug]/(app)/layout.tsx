import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { OrganizationShell } from "@/components/organization-shell";

export const dynamic = "force-dynamic";

export default async function WorkspaceShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization, organizations, user } =
    await loadOrganizationRouteContext(orgSlug);

  return (
    <OrganizationShell
      currentOrganization={currentOrganization}
      organizations={organizations.map((organization) => ({
        name: organization.name,
        slug: organization.slug,
      }))}
      user={{
        email: user.email,
        isPlatformAdmin: user.isPlatformAdmin,
        name: user.name,
      }}
    >
      {children}
    </OrganizationShell>
  );
}
