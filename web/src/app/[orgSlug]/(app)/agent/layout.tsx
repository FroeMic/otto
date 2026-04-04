import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { AgentTabs } from "@/app/[orgSlug]/(app)/agent/_components/agent-tabs";

export default async function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await loadOrganizationRouteContext(orgSlug);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Agent</p>
          <h1 className="min-w-0 text-3xl font-semibold">Otto</h1>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Review the instruction files that shape how Otto works with your
              workspace.
            </p>
          </div>
        </div>
        <AgentTabs orgSlug={orgSlug} />
      </section>

      {children}
    </div>
  );
}
