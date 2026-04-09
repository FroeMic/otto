import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  AgentCapability,
  AgentCapabilityDirection,
} from "@/lib/agent-capabilities";

const directionConfig: Record<
  AgentCapabilityDirection,
  { label: string; order: number }
> = {
  trigger: { label: "Session Triggers", order: 0 },
  tool: { label: "Tools", order: 1 },
  read: { label: "Read Access", order: 2 },
};

function groupByDirection(capabilities: AgentCapability[]) {
  const groups = new Map<AgentCapabilityDirection, AgentCapability[]>();
  for (const cap of capabilities) {
    const existing = groups.get(cap.direction) ?? [];
    existing.push(cap);
    groups.set(cap.direction, existing);
  }
  return [...groups.entries()].sort(
    ([a], [b]) => directionConfig[a].order - directionConfig[b].order,
  );
}

export function AgentCapabilitiesCard({
  capabilities,
}: {
  capabilities: AgentCapability[];
}) {
  if (capabilities.length === 0) return null;

  const groups = groupByDirection(capabilities);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent capabilities</CardTitle>
        <CardDescription>
          What Otto can do through this integration.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {groups.map(([direction, caps]) => (
          <div key={direction} className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {directionConfig[direction].label}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {caps.map((cap) => (
                <li key={cap.key} className="flex flex-col">
                  <span className="text-sm font-medium">{cap.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {cap.description}
                  </span>
                  {cap.conditionNote ? (
                    <span className="text-xs text-muted-foreground/70">
                      {cap.conditionNote}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
