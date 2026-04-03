"use client";

import { useState } from "react";

import {
  SettingsCard,
  SettingsPage,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
  SettingsRow,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function FixedCopyButton({
  copied,
  onClick,
}: {
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <Button className="w-20" onClick={onClick} type="button" variant="outline">
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function CommandBlock({
  action,
  label,
  value,
}: {
  action?: React.ReactNode;
  label: React.ReactNode;
  value: string;
}) {
  return (
    <SettingsRow className="flex-col items-start gap-3">
      <div className="w-full min-w-0 text-sm font-medium">{label}</div>
      <div className="flex w-full items-center gap-3">
        <div
          className={cn(
            "min-w-0 flex-1 rounded-3xl bg-muted px-4 py-1.5",
            "font-mono text-xs leading-6 break-all text-foreground",
          )}
        >
          {value}
        </div>
        {action ? (
          <div className="flex shrink-0 items-center gap-2">{action}</div>
        ) : null}
      </div>
    </SettingsRow>
  );
}

type PlatformAccessContentProps = {
  dashboardUrl: string;
  gatewayToken: string | null;
  hostSshCommand: string | null;
  hostSshCustomKeyCommand: string | null;
  ipv4: string | null;
  sshTunnelCommand: string | null;
};

export function PlatformAccessContent({
  dashboardUrl,
  gatewayToken,
  hostSshCommand,
  hostSshCustomKeyCommand,
  ipv4,
  sshTunnelCommand,
}: PlatformAccessContentProps) {
  const [copiedField, setCopiedField] = useState<
    | null
    | "dashboard-url"
    | "gateway-token"
    | "host-ssh"
    | "host-ssh-custom"
    | "server-ip"
    | "inspect-image"
    | "open-shell"
    | "ssh-tunnel"
  >(null);
  const [isTokenVisible, setIsTokenVisible] = useState(false);

  async function copyToClipboard(
    value: string,
    field:
      | "dashboard-url"
      | "gateway-token"
      | "host-ssh"
      | "host-ssh-custom"
      | "server-ip"
      | "inspect-image"
      | "open-shell"
      | "ssh-tunnel",
  ) {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current));
    }, 2000);
  }

  const inspectImageCommand =
    "docker inspect openclaw-gateway --format '{{.Config.Image}}'";
  const openShellCommand = "docker exec -it openclaw-gateway bash";
  const visibleGatewayToken =
    gatewayToken && !isTokenVisible
      ? "\u2022".repeat(Math.max(gatewayToken.length, 24))
      : gatewayToken;

  return (
    <SettingsPage className="mx-0 max-w-2xl">
      <div className="flex w-full flex-col gap-10 pb-8">
        <SettingsSection>
          <SettingsSectionTitle>Server access</SettingsSectionTitle>
          <SettingsSectionDescription>
            SSH into the tenant server directly when you need host-level
            inspection or container-level commands.
          </SettingsSectionDescription>

          <div className="flex flex-col gap-5">
            <SettingsCard>
              {ipv4 ? (
                <CommandBlock
                  action={
                    <FixedCopyButton
                      copied={copiedField === "server-ip"}
                      onClick={() => copyToClipboard(ipv4, "server-ip")}
                    />
                  }
                  label="Server IP"
                  value={ipv4}
                />
              ) : (
                <SettingsRow className="text-sm text-muted-foreground">
                  Server IP is not available yet.
                </SettingsRow>
              )}
              {hostSshCommand ? (
                <CommandBlock
                  action={
                    <FixedCopyButton
                      copied={copiedField === "host-ssh"}
                      onClick={() => copyToClipboard(hostSshCommand, "host-ssh")}
                    />
                  }
                  label="SSH"
                  value={hostSshCommand}
                />
              ) : null}
              {hostSshCustomKeyCommand ? (
                <CommandBlock
                  action={
                    <FixedCopyButton
                      copied={copiedField === "host-ssh-custom"}
                      onClick={() =>
                        copyToClipboard(hostSshCustomKeyCommand, "host-ssh-custom")
                      }
                    />
                  }
                  label="SSH with Otto key"
                  value={hostSshCustomKeyCommand}
                />
              ) : null}
            </SettingsCard>
          </div>

          <div className="flex flex-col gap-5">
            <SettingsCard>
              <CommandBlock
                action={
                  <FixedCopyButton
                    copied={copiedField === "inspect-image"}
                    onClick={() =>
                      copyToClipboard(inspectImageCommand, "inspect-image")
                    }
                  />
                }
                label="Inspect runtime image"
                value={inspectImageCommand}
              />
              <CommandBlock
                action={
                  <FixedCopyButton
                    copied={copiedField === "open-shell"}
                    onClick={() => copyToClipboard(openShellCommand, "open-shell")}
                  />
                }
                label="Shell into container"
                value={openShellCommand}
              />
            </SettingsCard>
          </div>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Gateway UI access</SettingsSectionTitle>
          <SettingsSectionDescription>
            Use this when you need direct runtime dashboard access for
            debugging.
          </SettingsSectionDescription>
          <SettingsCard>
            {sshTunnelCommand ? (
              <CommandBlock
                action={
                  <FixedCopyButton
                    copied={copiedField === "ssh-tunnel"}
                    onClick={() => copyToClipboard(sshTunnelCommand, "ssh-tunnel")}
                  />
                }
              label={
                  <span>Start SSH tunnel</span>
                }
                value={sshTunnelCommand}
              />
            ) : (
              <SettingsRow className="flex-col items-start gap-2">
                <span className="text-sm font-medium">Start SSH tunnel</span>
                <span className="text-sm text-muted-foreground">
                  The tenant server does not have a reachable IP yet.
                </span>
              </SettingsRow>
            )}
            <CommandBlock
              action={
                <FixedCopyButton
                  copied={copiedField === "dashboard-url"}
                  onClick={() => copyToClipboard(dashboardUrl, "dashboard-url")}
                />
              }
              label={
                <span>Open dashboard URL</span>
              }
              value={dashboardUrl}
            />
            {gatewayToken ? (
              <CommandBlock
                action={
                  <>
                    <Button
                      className="w-20"
                      onClick={() => setIsTokenVisible((current) => !current)}
                      type="button"
                      variant="ghost"
                    >
                      {isTokenVisible ? "Hide" : "Show"}
                    </Button>
                    <FixedCopyButton
                      copied={copiedField === "gateway-token"}
                      onClick={() => copyToClipboard(gatewayToken, "gateway-token")}
                    />
                  </>
                }
                label={
                  <span>Use gateway token</span>
                }
                value={visibleGatewayToken ?? ""}
              />
            ) : (
              <SettingsRow className="flex-col items-start gap-2">
                <span className="text-sm font-medium">Use gateway token</span>
                <span className="text-sm text-muted-foreground">
                  The deployment has not saved a gateway token yet.
                </span>
              </SettingsRow>
            )}
          </SettingsCard>
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}
