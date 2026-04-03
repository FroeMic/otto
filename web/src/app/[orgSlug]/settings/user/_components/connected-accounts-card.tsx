"use client";

import Image from "next/image";

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

type ConnectedIntegration = {
  provider: string;
  label: string;
  icon: string;
};

const providerMeta: Record<string, { label: string; icon: string }> = {
  slack: { label: "Slack", icon: "/integrations/slack.svg" },
  whatsapp: { label: "WhatsApp", icon: "/integrations/whatsapp.png" },
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
  connectedIntegrations,
}: {
  identities: ChannelIdentity[];
  connectedIntegrations: ConnectedIntegration[];
}) {
  const byProvider = new Map<string, ChannelIdentity>();
  for (const identity of identities) {
    if (!byProvider.has(identity.provider)) {
      byProvider.set(identity.provider, identity);
    }
  }

  if (connectedIntegrations.length === 0) {
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
    );
  }

  return (
    <SettingsCard>
      {connectedIntegrations.map((integration) => {
        const identity = byProvider.get(integration.provider);
        const meta = providerMeta[integration.provider] ?? {
          label: integration.label,
          icon: integration.icon,
        };

        return (
          <SettingsRow key={integration.provider}>
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                <Image
                  alt={meta.label}
                  className="size-5"
                  height={20}
                  src={meta.icon}
                  width={20}
                />
              </div>
              <SettingsRowLabel>
                <SettingsRowTitle>{meta.label}</SettingsRowTitle>
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
                    Not linked — your email may not match your {meta.label}{" "}
                    profile
                  </SettingsRowDescription>
                )}
              </SettingsRowLabel>
            </div>
            {identity ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-emerald-500"
                />
                <span className="text-sm text-muted-foreground">
                  Connected
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground shrink-0">
                Not linked
              </span>
            )}
          </SettingsRow>
        );
      })}
    </SettingsCard>
  );
}
