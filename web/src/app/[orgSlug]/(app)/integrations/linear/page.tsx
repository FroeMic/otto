import Image from "next/image";
import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { AgentCapabilitiesCard } from "@/components/agent-capabilities-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTenantManagedIntegrationSummary } from "@/db/control-plane";
import { getManagedIntegrationDefinition } from "@/lib/managed-integrations/catalog";
import { isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type LinearIntegrationUiState =
  | "connected"
  | "disabled"
  | "disconnected"
  | "needs_attention";

function getUiState(input: {
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  lastError: string | null;
  status: string | null;
}): LinearIntegrationUiState {
  if (input.lastError || input.status === "error") {
    return "needs_attention";
  }

  if (input.status === "disabled") {
    return "disabled";
  }

  if (
    input.connectedAt &&
    !input.disconnectedAt &&
    input.status === "connected"
  ) {
    return "connected";
  }

  return "disconnected";
}

function getStatusBadgeVariant(state: LinearIntegrationUiState) {
  switch (state) {
    case "connected":
      return "outline" as const;
    case "needs_attention":
      return "destructive" as const;
    case "disabled":
    case "disconnected":
      return "secondary" as const;
  }
}

function getStatusLabel(state: LinearIntegrationUiState) {
  switch (state) {
    case "connected":
      return "Connected";
    case "disabled":
      return "Disabled";
    case "needs_attention":
      return "Needs attention";
    case "disconnected":
      return "Not connected";
  }
}

function getStatusCopy(input: {
  lastError: string | null;
  state: LinearIntegrationUiState;
}) {
  switch (input.state) {
    case "connected":
      return "Linear is connected for this workspace. Otto will be able to use the managed integration surface once the real runtime capability ships.";
    case "disabled":
      return "Linear is recorded for this workspace, but it is currently disabled.";
    case "needs_attention":
      return (
        input.lastError ??
        "Linear needs attention before Otto can rely on it for managed integration work."
      );
    case "disconnected":
      return "The Linear connect flow has not shipped yet. This page defines the provider shell, capability inventory, and status model ahead of OAuth.";
  }
}

export default async function LinearIntegrationPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization, user } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const definition = getManagedIntegrationDefinition("linear");

  if (!definition) {
    throw new Error("Managed integration definition for Linear is missing.");
  }

  const summary = await getTenantManagedIntegrationSummary({
    orgSlug,
    providerKey: definition.key,
    userExternalId: user.id,
  });
  const state = getUiState({
    connectedAt: summary?.connectedAt ?? null,
    disconnectedAt: summary?.disconnectedAt ?? null,
    lastError: summary?.lastError ?? null,
    status: summary?.status ?? null,
  });

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 pb-12">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Image
                alt=""
                className="size-8"
                height={32}
                src={definition.iconSrc ?? "/integrations/web-search.svg"}
                width={32}
              />
              <h1 className="text-3xl font-semibold tracking-tight">
                {definition.label}
              </h1>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {definition.pageDescription}
            </p>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Connection status</CardTitle>
          <CardDescription>
            Workspace-owned managed integration state for Linear.
          </CardDescription>
          <CardAction>
            <Badge variant={getStatusBadgeVariant(state)}>
              {getStatusLabel(state)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {getStatusCopy({
              lastError: summary?.lastError ?? null,
              state,
            })}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-3xl border border-border/60 p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Provider key
              </span>
              <span className="text-sm font-medium">{definition.key}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-3xl border border-border/60 p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Last connected
              </span>
              <span className="text-sm font-medium">
                {summary?.connectedAt
                  ? summary.connectedAt.toISOString()
                  : "Not connected yet"}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-3xl border border-border/60 p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Last updated
              </span>
              <span className="text-sm font-medium">
                {summary?.lastErrorAt
                  ? summary.lastErrorAt.toISOString()
                  : "No error recorded"}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-3xl border border-border/60 p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                OAuth status
              </span>
              <span className="text-sm font-medium">
                Connect flow coming in the next slice
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button disabled>Connect Linear</Button>
            <p className="text-sm text-muted-foreground">
              This increment ships the Linear workspace shell only. OAuth and
              provider traffic land next.
            </p>
          </div>
        </CardContent>
      </Card>

      <AgentCapabilitiesCard capabilities={definition.agentCapabilities} />

      <Card>
        <CardHeader>
          <CardTitle>Planned flow</CardTitle>
          <CardDescription>
            The next increment wires the actual Linear OAuth lifecycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <div className="rounded-3xl border border-border/60 p-4">
            1. Start the Linear connect flow from your workspace.
          </div>
          <div className="rounded-3xl border border-border/60 p-4">
            2. Complete consent through hosted Nango.
          </div>
          <div className="rounded-3xl border border-border/60 p-4">
            3. Otto stores the canonical installation state and later exposes
            Linear through the managed runtime integration surface.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
