import { PlatformShell } from "@/app/platform/_components/platform-shell";
import { loadPlatformRouteContext } from "@/app/platform/_lib/platform-context";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { organizations, user } = await loadPlatformRouteContext();

  return (
    <PlatformShell
      organizations={organizations}
      user={{
        email: user.email,
        name: user.name,
      }}
    >
      {children}
    </PlatformShell>
  );
}
