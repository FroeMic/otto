import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"

import type { ConnectedAccount } from "../types"

export interface ConnectedAccountsCardProps {
  connectedAccounts: ConnectedAccount[]
}

export function ConnectedAccountsCard({
  connectedAccounts,
}: ConnectedAccountsCardProps) {
  if (connectedAccounts.length === 0) {
    return (
      <SettingsCard>
        <SettingsRow>
          <SettingsRowLabel>
            <SettingsRowDescription>
              No messaging integrations connected to this workspace yet.
            </SettingsRowDescription>
          </SettingsRowLabel>
        </SettingsRow>
      </SettingsCard>
    )
  }

  return (
    <SettingsCard>
      {connectedAccounts.map((identity) => (
        <SettingsRow key={identity.id}>
          <SettingsRowLabel>
            <SettingsRowTitle>{identity.provider}</SettingsRowTitle>
            <SettingsRowDescription>
              {[identity.fullName, identity.username ? `@${identity.username}` : null]
                .filter(Boolean)
                .join(" · ") || identity.displayName || identity.externalId}
            </SettingsRowDescription>
            <SettingsRowDescription className="font-mono text-xs text-muted-foreground/70">
              {identity.externalId}
            </SettingsRowDescription>
          </SettingsRowLabel>
          <div className="flex shrink-0 items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-muted-foreground">Connected</span>
          </div>
        </SettingsRow>
      ))}
    </SettingsCard>
  )
}
