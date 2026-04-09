import { handleWorkspaceUsageRequest } from "@otto/feature-workspace-core";
import { withAuth } from "@workos-inc/authkit-nextjs";

import { getOrganizationTenantForBilling } from "@/db/billing";
import {
  getOrganizationWorkspaceBySlug,
  syncUserFromSession,
} from "@/db/control-plane";
import { getTenantProviderUsageOverview } from "@/db/provider-usage";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
    }>;
  },
) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug } = await context.params;

  return handleWorkspaceUsageRequest({
    getOrganizationTenantForBilling,
    getOrganizationWorkspaceBySlug,
    getTenantProviderUsageOverview,
    orgSlug,
    request,
    syncUserFromSession,
    user,
  });
}
