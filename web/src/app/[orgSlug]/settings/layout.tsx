import { loadReadyOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { SettingsShell } from "@/app/[orgSlug]/settings/_components/settings-shell";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization, organizations, user } =
    await loadReadyOrganizationRouteContext(orgSlug);

  return (
    <SettingsShell
      currentOrganization={{
        name: currentOrganization.name,
        slug: currentOrganization.slug,
      }}
      organizations={organizations.map((organization) => ({
        name: organization.name,
        slug: organization.slug,
      }))}
      user={{
        email: user.email,
        id: user.id,
        name: user.name,
      }}
    >
      {children}
    </SettingsShell>
  );
}
