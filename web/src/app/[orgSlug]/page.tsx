import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

import { getDashboardOrganizations } from "@/db/control-plane";
import { getOrganizationHomePath } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function OrganizationIndexPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug } = await params;
  const organizations = await getDashboardOrganizations(user.id);
  const organization = organizations.find((item) => item.slug === orgSlug);

  if (!organization) {
    redirect("/");
  }

  redirect(getOrganizationHomePath(organization));
}
