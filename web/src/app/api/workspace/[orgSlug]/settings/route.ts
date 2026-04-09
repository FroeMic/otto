import { handleWorkspaceSettingsUpdateRequest } from "@otto/feature-workspace-core";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  getOrganizationWorkspaceBySlug,
  syncUserFromSession,
  updateWorkspaceDateTimePreferences,
} from "@/db/control-plane";
import { organizations } from "@/db/schema";
import { getWorkOS } from "@/lib/workos";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgSlug: string }> },
) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug } = await context.params;

  return handleWorkspaceSettingsUpdateRequest({
    getOrganizationWorkspaceBySlug,
    orgSlug,
    renameOrganization: async (payload) => {
      const db = getDb();
      const workos = getWorkOS();

      await workos.organizations.updateOrganization({
        organization: payload.externalOrganizationId,
        name: payload.name,
      });

      await db
        .update(organizations)
        .set({ name: payload.name, updatedAt: new Date() })
        .where(eq(organizations.id, payload.organizationId));
    },
    request,
    syncUserFromSession,
    updateOrganizationSlug: async (payload) => {
      const db = getDb();
      const [existing] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, payload.slug))
        .limit(1);

      if (existing && existing.id !== payload.organizationId) {
        return "slug_taken";
      }

      await db
        .update(organizations)
        .set({ slug: payload.slug, updatedAt: new Date() })
        .where(eq(organizations.id, payload.organizationId));

      return "ok";
    },
    updateWorkspaceDateTimePreferences,
    user,
  });
}
