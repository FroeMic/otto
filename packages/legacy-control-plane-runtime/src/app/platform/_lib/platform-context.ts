import { withAuth } from "@workos-inc/authkit-nextjs";
import { notFound } from "next/navigation";

import {
  getDashboardOrganizations,
  hasPlatformAdminRole,
  syncUserFromSession,
} from "../../../db/control-plane";

type PlatformRouteContext = {
  organizations: Array<{
    name: string;
    slug: string;
  }>;
  user: {
    email: string;
    id: string;
    name: string;
  };
};

export async function loadPlatformRouteContext(): Promise<PlatformRouteContext> {
  const { user } = await withAuth({ ensureSignedIn: true });
  await syncUserFromSession(user);

  const isPlatformAdmin = await hasPlatformAdminRole(user.id);

  if (!isPlatformAdmin) {
    notFound();
  }

  const organizations = await getDashboardOrganizations(user.id);

  return {
    organizations: organizations.map((organization) => ({
      name: organization.name,
      slug: organization.slug,
    })),
    user: {
      email: user.email,
      id: user.id,
      name:
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
    },
  };
}
