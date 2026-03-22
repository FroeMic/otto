import Link from "next/link";
import { redirect } from "next/navigation";

import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { WhatsAppIntegrationPanel } from "@/app/[orgSlug]/(app)/integrations/whatsapp/_components/whatsapp-integration-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getCurrentTenantWhatsAppLinkSession,
  getTenantWhatsAppRuntimeConfigSurface,
} from "@/db/control-plane";
import {
  getPrimaryAgentLatestApplyRun,
  getRuntimeApplyStatusLabel,
  getRuntimeStatusLabel,
  getWhatsAppUiPhase,
  getWhatsAppUiPhaseLabel,
  isOrganizationUnlocked,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

function getStatusAlert(input: {
  integrationError: string | null;
  phase: ReturnType<typeof getWhatsAppUiPhase>;
  runtimeApplyError: string | null;
  runtimeApplyIsActive: boolean;
}) {
  if (input.integrationError) {
    return {
      description: input.integrationError,
      title: "WhatsApp needs attention",
      variant: "destructive" as const,
    };
  }

  if (input.runtimeApplyError) {
    return {
      description: input.runtimeApplyError,
      title: "Otto could not finish the latest WhatsApp update",
      variant: "destructive" as const,
    };
  }

  if (input.runtimeApplyIsActive) {
    return {
      description:
        input.phase === "activating"
          ? "Pairing succeeded. Otto is now activating WhatsApp in the tenant runtime."
          : "Otto is still applying the latest WhatsApp configuration in the background.",
      title:
        input.phase === "activating"
          ? "Otto is activating WhatsApp"
          : "Otto is updating",
      variant: "default" as const,
    };
  }

  if (input.phase === "prepare") {
    return {
      description:
        "Generate a QR code to connect one dedicated WhatsApp Business number. Otto will activate WhatsApp in the tenant runtime after pairing succeeds.",
      title: "WhatsApp is ready to connect",
      variant: "default" as const,
    };
  }

  return null;
}

function getStatusBadgeVariant(input: {
  integrationError: string | null;
  runtimeApplyError: string | null;
  runtimeApplyIsActive: boolean;
  whatsappStatus: string | null;
}) {
  if (input.integrationError || input.runtimeApplyError) {
    return "destructive" as const;
  }

  if (input.runtimeApplyIsActive) {
    return "secondary" as const;
  }

  if (input.whatsappStatus === "connected") {
    return "outline" as const;
  }

  return "secondary" as const;
}

export default async function WhatsAppIntegrationPage({
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

  const integration = organization.whatsappIntegration;
  const [surface, currentLinkSession] = await Promise.all([
    integration
      ? getTenantWhatsAppRuntimeConfigSurface({
          orgSlug,
          userExternalId: user.id,
        })
      : Promise.resolve(null),
    integration
      ? getCurrentTenantWhatsAppLinkSession({
          orgSlug,
          userExternalId: user.id,
        })
      : Promise.resolve(null),
  ]);
  const latestApplyRun = getPrimaryAgentLatestApplyRun(organization);
  const runtimeApplyStatusLabel = getRuntimeApplyStatusLabel(organization);
  const whatsappPhase = getWhatsAppUiPhase({
    integrationStatus: integration?.status ?? null,
    linkSessionStatus: currentLinkSession?.status ?? null,
  });
  const runtimeApplyIsActive =
    integration?.status === "pending_apply" ||
    integration?.status === "applying" ||
    integration?.status === "activating" ||
    latestApplyRun?.status === "queued" ||
    latestApplyRun?.status === "loading_desired_state" ||
    latestApplyRun?.status === "rendering_files" ||
    latestApplyRun?.status === "writing_files" ||
    latestApplyRun?.status === "restarting_runtime" ||
    latestApplyRun?.status === "verifying_runtime";
  const runtimeApplyError =
    integration?.status === "apply_failed"
      ? (integration.lastError ?? latestApplyRun?.error ?? null)
      : latestApplyRun?.status === "failed"
        ? latestApplyRun.error
        : null;
  const integrationError =
    integration?.status === "link_failed" ||
    integration?.status === "apply_failed"
      ? integration.lastError
      : null;
  const statusAlert = getStatusAlert({
    integrationError,
    phase: whatsappPhase,
    runtimeApplyError,
    runtimeApplyIsActive,
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-12">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Integrations / WhatsApp
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                  WhatsApp
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Connect one dedicated WhatsApp Business number to Otto, show a
                  QR code in your workspace, and control who can reach it.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge
                  variant={getStatusBadgeVariant({
                    integrationError,
                    runtimeApplyError,
                    runtimeApplyIsActive,
                    whatsappStatus: whatsappPhase,
                  })}
                >
                  {getWhatsAppUiPhaseLabel(whatsappPhase)}
                </Badge>
                {whatsappPhase !== "prepare" && integration?.selfE164 ? (
                  <span>Number: {integration.selfE164}</span>
                ) : null}
                <span>Otto: {getRuntimeStatusLabel(organization)}</span>
                {runtimeApplyStatusLabel &&
                (whatsappPhase === "activating" ||
                  whatsappPhase === "connected" ||
                  whatsappPhase === "attention") ? (
                  <span>Latest sync: {runtimeApplyStatusLabel}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {statusAlert ? (
          <Alert variant={statusAlert.variant}>
            <AlertTitle>{statusAlert.title}</AlertTitle>
            <AlertDescription>{statusAlert.description}</AlertDescription>
          </Alert>
        ) : null}
      </section>

      <Separator />

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          {whatsappPhase === "connected" && integration?.connectedAt ? (
            <span>Connected {integration.connectedAt.toLocaleString()}</span>
          ) : null}
        </div>
        <Link href={`/${organization.slug}/integrations`}>
          View all integrations
        </Link>
      </div>

      <WhatsAppIntegrationPanel
        initialIntegration={integration}
        initialLinkSession={currentLinkSession}
        initialSurface={surface}
        orgSlug={orgSlug}
        runtimeApplyIsActive={runtimeApplyIsActive}
      />
    </div>
  );
}
