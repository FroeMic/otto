"use client";

import { useState } from "react";

import { Button } from "../../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";

type GatewayAccessCardProps = {
  dashboardUrl: string;
  gatewayToken: string | null;
  sshTunnelCommand: string | null;
};

export function GatewayAccessCard({
  dashboardUrl,
  gatewayToken,
  sshTunnelCommand,
}: GatewayAccessCardProps) {
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [copiedField, setCopiedField] = useState<
    null | "command" | "token" | "url"
  >(null);

  async function copyToClipboard(
    value: string,
    field: "command" | "token" | "url",
  ) {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current));
    }, 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gateway access</CardTitle>
        <CardDescription>
          Access the OpenClaw dashboard through an SSH tunnel and authenticate
          with the current gateway token.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Dashboard URL</p>
          <div className="flex gap-2">
            <Input readOnly value={dashboardUrl} className="font-mono" />
            <Button
              type="button"
              variant="outline"
              onClick={() => copyToClipboard(dashboardUrl, "url")}
            >
              {copiedField === "url" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        {sshTunnelCommand ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">SSH tunnel</p>
            <div className="flex gap-2">
              <Input readOnly value={sshTunnelCommand} className="font-mono" />
              <Button
                type="button"
                variant="outline"
                onClick={() => copyToClipboard(sshTunnelCommand, "command")}
              >
                {copiedField === "command" ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">SSH tunnel</p>
            <p className="text-sm text-muted-foreground">
              This deployment does not have a reachable server IP yet, so Otto
              cannot show the tunnel command.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Gateway token</p>
          {gatewayToken ? (
            <>
              <div className="flex gap-2">
                <Input
                  readOnly
                  type={isTokenVisible ? "text" : "password"}
                  value={gatewayToken}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTokenVisible((current) => !current)}
                >
                  {isTokenVisible ? "Hide" : "Show"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyToClipboard(gatewayToken, "token")}
                >
                  {copiedField === "token" ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste this into the OpenClaw dashboard auth prompt when the UI
                asks for `gateway.auth.token`.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              The deployment has not saved a gateway token yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
