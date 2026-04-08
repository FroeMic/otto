import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function IntegrationCapabilitiesPage({
  params,
}: {
  params: Promise<{ integrationKey: string; orgSlug: string }>;
}) {
  const { integrationKey, orgSlug } = await params;
  redirect(`/${orgSlug}/integrations2/${integrationKey}?tab=capabilities`);
}
