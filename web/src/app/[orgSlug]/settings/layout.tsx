import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
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
  const { currentOrganization, user } =
    await loadOrganizationRouteContext(orgSlug);

  return (
    <SettingsShell
      currentOrganization={{
        name: currentOrganization.name,
        slug: currentOrganization.slug,
      }}
      user={{
        email: user.email,
        name: user.name,
      }}
    >
      {children}
    </SettingsShell>
  );
}
