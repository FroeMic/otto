import { Badge } from "@/components/ui/badge"
import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"
import type { WorkspaceIntegrationCapabilityRow } from "@otto/feature-integrations-runtime/workspace"

export interface IntegrationCapabilitiesListProps {
  rows: WorkspaceIntegrationCapabilityRow[]
}

function formatCapabilityType(type: WorkspaceIntegrationCapabilityRow["capabilityType"]) {
  return type === "trigger" ? "Trigger" : "Command"
}

function formatCapabilityEffect(effect: WorkspaceIntegrationCapabilityRow["effect"]) {
  if (effect === "read") {
    return "Read"
  }

  if (effect === "write") {
    return "Write"
  }

  return "—"
}

function formatCapabilityStatus(status: WorkspaceIntegrationCapabilityRow["status"]) {
  if (status === "needs_attention") {
    return "Needs attention"
  }

  return status === "enabled" ? "Enabled" : "Disabled"
}

export function IntegrationCapabilitiesList({
  rows,
}: IntegrationCapabilitiesListProps) {
  return (
    <SettingsCard>
      {rows.map((row) => (
        <SettingsRow key={row.capabilityKey} className="items-start">
          <SettingsRowLabel>
            <div className="flex flex-wrap items-center gap-2">
              <SettingsRowTitle>{row.label}</SettingsRowTitle>
              <Badge variant="outline">{formatCapabilityType(row.capabilityType)}</Badge>
              <Badge variant={row.status === "needs_attention" ? "destructive" : "secondary"}>
                {formatCapabilityStatus(row.status)}
              </Badge>
            </div>
            <SettingsRowDescription>{row.description}</SettingsRowDescription>
          </SettingsRowLabel>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <span>{formatCapabilityEffect(row.effect)}</span>
            {row.commandGroup ? <span>{row.commandGroup}</span> : null}
          </div>
        </SettingsRow>
      ))}
    </SettingsCard>
  )
}
