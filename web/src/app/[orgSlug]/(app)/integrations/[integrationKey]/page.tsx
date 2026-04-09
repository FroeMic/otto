import { redirect } from "next/navigation";

import { buildIntegrationSectionPath } from "@/integrations/framework/routing";

export const dynamic = "force-dynamic";

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ integrationKey: string; orgSlug: string }>;
}) {
  const { integrationKey, orgSlug } = await params;
  redirect(
    buildIntegrationSectionPath({
      integrationKey,
      orgSlug,
      section: "status",
    }),
  );
}
