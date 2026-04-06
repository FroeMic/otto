import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

import {
  type DashboardOrganization,
  getDashboardOrganizations,
  hasPlatformAdminRole,
} from "@/db/control-plane";
import {
  getOrganizationHomePath,
  getPendingAccessPath,
  isOrganizationReady,
} from "@/lib/workspace";

type OrganizationRouteContext = {
  currentOrganization: DashboardOrganization;
  organizations: DashboardOrganization[];
  user: {
    email: string;
    id: string;
    isPlatformAdmin: boolean;
    name: string;
  };
};

export async function loadOrganizationRouteContext(
  orgSlug: string,
): Promise<OrganizationRouteContext> {
  const { user } = await withAuth({ ensureSignedIn: true });
  const organizations = await getDashboardOrganizations(user.id);
  const isPlatformAdmin = await hasPlatformAdminRole(user.id);

  if (organizations.length === 0) {
    redirect("/onboarding/create-organization");
  }

  const currentOrganization = organizations.find(
    (organization) => organization.slug === orgSlug,
  );

  if (!currentOrganization) {
    redirect(getOrganizationHomePath(organizations[0]));
  }

  if (!isOrganizationReady(currentOrganization)) {
    redirect(getPendingAccessPath(currentOrganization.slug));
  }

  return {
    currentOrganization,
    organizations,
    user: {
      email: user.email,
      id: user.id,
      isPlatformAdmin,
      name:
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
    },
  };
}
