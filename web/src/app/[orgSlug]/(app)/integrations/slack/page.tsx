import { redirect } from "next/navigation";

import { buildIntegrationSectionPath } from "@/integrations/framework/routing";

export const dynamic = "force-dynamic";

export default async function SlackIntegrationPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  redirect(
    buildIntegrationSectionPath({
      integrationKey: "slack",
      orgSlug,
      section: "status",
    }),
  );
}
