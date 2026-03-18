import { AgentTabs } from "@/app/[orgSlug]/(app)/agent/_components/agent-tabs";

export default async function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Agent</p>
          <h1 className="text-3xl font-semibold">Otto</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Check whether Otto is ready, and review the instructions that shape
            how it works with your workspace.
          </p>
        </div>
        <AgentTabs orgSlug={orgSlug} />
      </section>

      {children}
    </div>
  );
}
