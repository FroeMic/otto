import { loadPlatformRouteContext } from "../_lib/platform-context";
import { PlatformOrganizationsTable } from "./_components/platform-organizations-table";
import { listPlatformOrganizations } from "../../../db/control-plane";

export const dynamic = "force-dynamic";

export default async function PlatformOrganizationsPage() {
  const { user } = await loadPlatformRouteContext();
  const organizations = await listPlatformOrganizations({
    userExternalId: user.id,
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 pt-6">
      <div className="px-4 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
      </div>
      <PlatformOrganizationsTable organizations={organizations} />
    </div>
  );
}
