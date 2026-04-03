import { redirect } from "next/navigation";

import { getDefaultAgentInstructionTab } from "@/app/[orgSlug]/(app)/agent/_lib/agent-instruction-tabs";

export default async function AgentIndexPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const defaultTab = getDefaultAgentInstructionTab();

  redirect(`/${orgSlug}/agent/${encodeURIComponent(defaultTab.slug)}`);
}
