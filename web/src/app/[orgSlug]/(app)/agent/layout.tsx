import { AgentTabs } from "@/app/[orgSlug]/(app)/agent/_components/agent-tabs";
import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { getAgentReadinessSummary } from "@/lib/workspace";

export default async function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);
  const readiness = getAgentReadinessSummary(organization);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Agent</p>
          <div className="flex items-center justify-between gap-4">
            <h1 className="min-w-0 text-3xl font-semibold">Otto</h1>
            <HoverCard>
              <HoverCardTrigger>
                <Badge className="shrink-0" variant={readiness.variant}>
                  {readiness.label}
                </Badge>
              </HoverCardTrigger>
              <HoverCardContent align="end" className="w-72 rounded-2xl">
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {readiness.title}
                    </div>
                    <div className="mt-1 text-sm leading-5 text-muted-foreground">
                      {readiness.detail}
                    </div>
                  </div>
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <div>Slack: {readiness.slackStatus}</div>
                    <div>Runtime: {readiness.runtimeStatus}</div>
                    <div>Latest apply: {readiness.applyStatus}</div>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
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
