"use client";

import {
  SettingsCard,
  SettingsRow,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsRowDescription,
} from "@/app/[orgSlug]/settings/_components/settings-layout";

type ChannelIdentity = {
  id: string;
  provider: string;
  externalId: string;
  displayName: string | null;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

const providerConfig: Record<
  string,
  { label: string; icon: string }
> = {
  slack: {
    label: "Slack",
    icon: "/integrations/slack.svg",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: "/integrations/whatsapp.svg",
  },
  telegram: {
    label: "Telegram",
    icon: "/integrations/telegram.svg",
  },
  discord: {
    label: "Discord",
    icon: "/integrations/discord.svg",
  },
};

function formatIdentityDetail(identity: ChannelIdentity): string {
  const parts: string[] = [];
  if (identity.fullName) parts.push(identity.fullName);
  if (identity.username) parts.push(`@${identity.username}`);
  if (parts.length === 0 && identity.displayName) {
    parts.push(identity.displayName);
  }
  return parts.join(" · ");
}

export function ConnectedAccountsCard({
  identities,
}: {
  identities: ChannelIdentity[];
}) {
  // Group by provider
  const byProvider = new Map<string, ChannelIdentity>();
  for (const identity of identities) {
    // Take the first identity per provider (most common case)
    if (!byProvider.has(identity.provider)) {
      byProvider.set(identity.provider, identity);
    }
  }

  // Show connected providers + known unconnected ones
  const providers = ["slack", "whatsapp", "telegram", "discord"];

  return (
    <SettingsCard>
      {providers.map((provider) => {
        const identity = byProvider.get(provider);
        const config = providerConfig[provider] ?? {
          label: provider,
          icon: "",
        };

        return (
          <SettingsRow key={provider}>
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                {config.icon ? (
                  <img
                    alt={config.label}
                    className="size-5"
                    src={config.icon}
                  />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    {config.label.charAt(0)}
                  </span>
                )}
              </div>
              <SettingsRowLabel>
                <SettingsRowTitle>{config.label}</SettingsRowTitle>
                {identity ? (
                  <>
                    <SettingsRowDescription>
                      {formatIdentityDetail(identity)}
                    </SettingsRowDescription>
                    <SettingsRowDescription className="font-mono text-xs text-muted-foreground/70">
                      {identity.externalId}
                    </SettingsRowDescription>
                  </>
                ) : (
                  <SettingsRowDescription>
                    Not connected
                  </SettingsRowDescription>
                )}
              </SettingsRowLabel>
            </div>
            {identity ? (
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-emerald-500"
                />
                <span className="text-sm text-muted-foreground">
                  Connected
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </SettingsRow>
        );
      })}
    </SettingsCard>
  );
}
