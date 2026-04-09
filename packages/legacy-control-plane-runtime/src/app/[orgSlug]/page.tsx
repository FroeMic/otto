import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

import { getDashboardOrganizations } from "../../db/control-plane";
import { getOrganizationHomePath } from "../../lib/workspace";

export const dynamic = "force-dynamic";

export default async function OrganizationIndexPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const startedAt = Date.now();
  const { user } = await withAuth({ ensureSignedIn: true });
  console.info("[workspace-index] withAuth complete", {
    durationMs: Date.now() - startedAt,
    userExternalId: user.id,
  });
  const { orgSlug } = await params;
  const organizations = await getDashboardOrganizations(user.id);
  console.info("[workspace-index] getDashboardOrganizations complete", {
    durationMs: Date.now() - startedAt,
    organizationCount: organizations.length,
    orgSlug,
    userExternalId: user.id,
  });
  const organization = organizations.find((item) => item.slug === orgSlug);

  if (!organization) {
    redirect("/");
  }

  console.info("[workspace-index] redirecting to organization home", {
    durationMs: Date.now() - startedAt,
    orgSlug,
    userExternalId: user.id,
  });

  redirect(getOrganizationHomePath(organization));
}
