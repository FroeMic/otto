import { PlatformShell } from "./_components/platform-shell";
import { loadPlatformRouteContext } from "./_lib/platform-context";
import { listPlatformOrganizationSlugs } from "../../db/control-plane";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { organizations, user } = await loadPlatformRouteContext();
  const platformOrganizations = await listPlatformOrganizationSlugs({
    userExternalId: user.id,
  });

  return (
    <PlatformShell
      organizations={organizations}
      platformOrganizations={platformOrganizations}
      user={{
        email: user.email,
        id: user.id,
        name: user.name,
      }}
    >
      {children}
    </PlatformShell>
  );
}
