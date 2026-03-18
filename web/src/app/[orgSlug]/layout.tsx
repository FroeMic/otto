import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";

export const dynamic = "force-dynamic";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await loadOrganizationRouteContext(orgSlug);

  return children;
}
