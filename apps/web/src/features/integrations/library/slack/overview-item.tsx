import { Link } from "@tanstack/react-router"

import { Badge } from "@/components/ui/badge"

import type { WorkspaceIntegrationCatalogEntry } from "../../types"

export interface SlackIntegrationOverviewItemProps {
  entry: WorkspaceIntegrationCatalogEntry
}

function formatCapabilityLabel(entry: WorkspaceIntegrationCatalogEntry) {
  if (entry.key === "brave") {
    return "Tools · Read access"
  }

  if (entry.key === "slack") {
    return "Triggers · Tools · Read access"
  }

  return "Tools · Read access"
}

export function SlackIntegrationOverviewItem({
  entry,
}: SlackIntegrationOverviewItemProps) {
  return (
    <Link
      className="flex items-center justify-between gap-4 px-5 py-5 transition-colors hover:bg-accent/30"
      to={entry.settingsPath}
    >
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <img alt={entry.label} className="size-6" src={entry.iconSrc ?? ""} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{entry.label}</span>
            {entry.connected ? (
              <Badge variant={entry.key === "brave" ? "secondary" : "outline"}>
                {entry.key === "brave" ? "Managed" : "Connected"}
              </Badge>
            ) : null}
            {entry.needsAttention ? (
              <Badge variant="destructive">Needs attention</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{entry.description}</p>
        </div>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatCapabilityLabel(entry)}
      </span>
    </Link>
  )
}
