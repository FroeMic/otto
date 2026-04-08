import { withAuth } from "@workos-inc/authkit-nextjs";
import { notFound } from "next/navigation";

import {
  getDashboardOrganizations,
  hasPlatformAdminRole,
  syncUserFromSession,
} from "@/db/control-plane";

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
  const startedAt = Date.now();
  console.info("[platform-context] load start");
  const { user } = await withAuth({ ensureSignedIn: true });
  console.info("[platform-context] withAuth complete", {
    durationMs: Date.now() - startedAt,
    userExternalId: user.id,
  });
  await syncUserFromSession(user);
  console.info("[platform-context] syncUserFromSession complete", {
    durationMs: Date.now() - startedAt,
    userExternalId: user.id,
  });

  const isPlatformAdmin = await hasPlatformAdminRole(user.id);
  console.info("[platform-context] hasPlatformAdminRole complete", {
    durationMs: Date.now() - startedAt,
    isPlatformAdmin,
    userExternalId: user.id,
  });

  if (!isPlatformAdmin) {
    notFound();
  }

  const organizations = await getDashboardOrganizations(user.id);
  console.info("[platform-context] getDashboardOrganizations complete", {
    durationMs: Date.now() - startedAt,
    organizationCount: organizations.length,
    userExternalId: user.id,
  });

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
