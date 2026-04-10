import Image from "next/image";
import Link from "next/link";
import { Badge } from "../../../../components/ui/badge";
import type { IntegrationOverviewItemProps } from "../../../framework";

export function LinearIntegrationListItem({
  entry,
}: IntegrationOverviewItemProps) {
  const capabilityLabel = entry.capabilitySummary
    ? [
        entry.capabilitySummary.triggers
          ? `${entry.capabilitySummary.triggers} trigger${entry.capabilitySummary.triggers !== 1 ? "s" : ""}`
          : null,
        entry.capabilitySummary.tools
          ? `${entry.capabilitySummary.tools} tool${entry.capabilitySummary.tools !== 1 ? "s" : ""}`
          : null,
        entry.capabilitySummary.reads
          ? `${entry.capabilitySummary.reads} read${entry.capabilitySummary.reads !== 1 ? "s" : ""}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <Link
      className="flex items-center justify-between gap-4 px-5 py-5 transition-colors hover:bg-accent/30"
      href={entry.settingsPath}
    >
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Image
            alt={entry.label}
            className="size-6"
            height={24}
            src="/integrations/linear.svg"
            width={24}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{entry.label}</span>
            {entry.connected ? (
              <Badge variant="outline">Connected</Badge>
            ) : null}
            {entry.needsAttention ? (
              <Badge variant="destructive">Needs attention</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{entry.description}</p>
        </div>
      </div>
      {capabilityLabel ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {capabilityLabel}
        </span>
      ) : null}
    </Link>
  );
}
