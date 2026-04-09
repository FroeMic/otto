import { handleWorkspaceBootstrapRequest } from "@otto/feature-workspace-core";
import { withAuth } from "@workos-inc/authkit-nextjs";

import {
  getDashboardOrganizations,
  hasPlatformAdminRole,
  syncUserFromSession,
} from "@/db/control-plane";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
    }>;
  },
) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug } = await context.params;

  return handleWorkspaceBootstrapRequest({
    getDashboardOrganizations,
    hasPlatformAdminRole,
    orgSlug,
    syncUserFromSession,
    user,
  });
}
