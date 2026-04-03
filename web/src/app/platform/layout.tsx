import { PlatformShell } from "@/app/platform/_components/platform-shell";
import { loadPlatformRouteContext } from "@/app/platform/_lib/platform-context";
import { listPlatformOrganizations } from "@/db/control-plane";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { organizations, user } = await loadPlatformRouteContext();
  const platformOrganizations = await listPlatformOrganizations({
    userExternalId: user.id,
  });

  return (
    <PlatformShell
      organizations={organizations}
      platformOrganizations={platformOrganizations.map((organization) => ({
        name: organization.name,
        slug: organization.slug,
      }))}
      user={{
        email: user.email,
        name: user.name,
      }}
    >
      {children}
    </PlatformShell>
  );
}
