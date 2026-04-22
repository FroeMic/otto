import {
  SettingsCard,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import type { ConnectedAccount } from "../types"

export interface ConnectedAccountsCardProps {
  connectedAccounts: ConnectedAccount[]
}

const providerMeta: Record<string, { icon: string; label: string }> = {
  slack: {
    icon: "/integrations/slack.svg",
    label: "Slack",
  },
}

function formatIdentityDetail(identity: ConnectedAccount) {
  const parts = []

  if (identity.fullName) {
    parts.push(identity.fullName)
  }

  if (identity.username) {
    parts.push(`@${identity.username}`)
  }

  if (parts.length === 0 && identity.displayName) {
    parts.push(identity.displayName)
  }

  return parts.join(" · ")
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
          <div className="flex items-center gap-3">
            <Avatar className="size-9 rounded-lg border bg-background">
              <AvatarImage
                alt={
                  providerMeta[identity.provider]?.label ?? identity.provider
                }
                className="size-5 object-contain"
                src={providerMeta[identity.provider]?.icon}
              />
              <AvatarFallback className="rounded-lg text-xs uppercase">
                {(
                  providerMeta[identity.provider]?.label ?? identity.provider
                ).slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <SettingsRowLabel>
              <SettingsRowTitle>
                {providerMeta[identity.provider]?.label ?? identity.provider}
              </SettingsRowTitle>
              <SettingsRowDescription>
                {formatIdentityDetail(identity) || identity.externalId}
              </SettingsRowDescription>
              <SettingsRowDescription className="font-mono text-xs text-muted-foreground/70">
                {identity.externalId}
              </SettingsRowDescription>
            </SettingsRowLabel>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-emerald-500"
            />
            <span className="text-sm text-muted-foreground">Connected</span>
          </div>
        </SettingsRow>
      ))}
    </SettingsCard>
  )
}
