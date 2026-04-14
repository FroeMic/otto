import type { DashboardOrganization } from "../db/control-plane";
import { buildIntegrationSectionPath } from "../integrations/framework/routing";

export type WhatsAppUiPhase =
  | "prepare"
  | "pairing"
  | "activating"
  | "connected"
  | "attention";

export function getWhatsAppUiPhase(input: {
  integrationStatus?: string | null;
  linkSessionStatus?: string | null;
}): WhatsAppUiPhase {
  if (
    input.linkSessionStatus === "queued" ||
    input.linkSessionStatus === "starting" ||
    input.linkSessionStatus === "qr_ready" ||
    input.integrationStatus === "linking"
  ) {
    return "pairing";
  }

  if (input.integrationStatus === "connected") {
    return "connected";
  }

  if (
    input.integrationStatus === "activating" ||
    input.integrationStatus === "pending_apply" ||
    input.integrationStatus === "applying"
  ) {
    return "activating";
  }

  if (
    input.integrationStatus === "apply_failed" ||
    input.integrationStatus === "link_failed" ||
    input.linkSessionStatus === "failed"
  ) {
    return "attention";
  }

  return "prepare";
}

export function getWhatsAppUiPhaseLabel(phase: WhatsAppUiPhase) {
  switch (phase) {
    case "prepare":
      return "Ready to connect";
    case "pairing":
      return "Waiting for scan";
    case "activating":
      return "Activating";
    case "connected":
      return "Connected";
    case "attention":
      return "Needs attention";
  }
}

export function getPendingAccessPath(orgSlug?: string) {
  if (!orgSlug) {
    return "/onboarding/wait-for-access";
  }

  return `/${encodeURIComponent(orgSlug)}/waiting`;
}

export function getPrimaryAgent(organization: DashboardOrganization) {
  return organization.tenants[0] ?? null;
}

export function isOrganizationReady(organization: DashboardOrganization) {
  return organization.isReady;
}

export function isSlackConnected(organization: DashboardOrganization) {
  return Boolean(organization.slackIntegration?.connectedAt);
}

export function getSlackErrorMessage(organization: DashboardOrganization) {
  return organization.slackIntegration?.lastError ?? null;
}

export type ConnectedMessagingSurface = {
  external?: boolean;
  href: string;
  iconSrc: string;
  key: "slack" | "whatsapp";
  label: string;
};

export function getConnectedMessagingSurfaces(
  organization: DashboardOrganization,
): ConnectedMessagingSurface[] {
  const surfaces: ConnectedMessagingSurface[] = [];
  const slackTeamId = organization.slackIntegration?.teamId;

  if (organization.slackIntegration?.connectedAt) {
    surfaces.push({
      external: Boolean(slackTeamId),
      href: slackTeamId
        ? `https://app.slack.com/client/${slackTeamId}`
        : buildIntegrationSectionPath({
            integrationKey: "slack",
            orgSlug: organization.slug,
            section: "status",
          }),
      iconSrc: "/integrations/slack.svg",
      key: "slack",
      label: "Slack",
    });
  }

  if (organization.whatsappIntegration?.status === "connected") {
    surfaces.push({
      href: buildIntegrationSectionPath({
        integrationKey: "whatsapp",
        orgSlug: organization.slug,
        section: "status",
      }),
      iconSrc: "/integrations/whatsapp.png",
      key: "whatsapp",
      label: "WhatsApp",
    });
  }

  return surfaces;
}

export function getPrimaryAgentLatestApplyRun(
  organization: DashboardOrganization,
) {
  return getPrimaryAgent(organization)?.latestApplyRun ?? null;
}

export function getRuntimeApplyStatusLabel(
  organization: DashboardOrganization,
) {
  const latestApplyRun = getPrimaryAgentLatestApplyRun(organization);

  if (!latestApplyRun) {
    return null;
  }

  switch (latestApplyRun.status) {
    case "queued":
    case "pending_apply":
      return "Queued";
    case "loading_desired_state":
    case "rendering_files":
    case "writing_files":
    case "restarting_runtime":
    case "verifying_runtime":
    case "applying":
      return "Applying";
    case "succeeded":
      return "Applied";
    case "failed":
    case "apply_failed":
      return "Failed";
    default:
      return latestApplyRun.status;
  }
}

export function getAgentReadinessSummary(organization: DashboardOrganization) {
  const agent = getPrimaryAgent(organization);
  const latestApplyRun = getPrimaryAgentLatestApplyRun(organization);
  const slackStatus = getSlackStatusLabel(organization);
  const runtimeStatus = getRuntimeStatusLabel(organization);
  const applyStatus = getRuntimeApplyStatusLabel(organization);
  const slackError = getSlackErrorMessage(organization);
  const latestApplyFailed =
    latestApplyRun?.status === "failed" ||
    latestApplyRun?.status === "apply_failed";
  const latestApplyUpdating =
    latestApplyRun?.status === "queued" ||
    latestApplyRun?.status === "pending_apply" ||
    latestApplyRun?.status === "loading_desired_state" ||
    latestApplyRun?.status === "rendering_files" ||
    latestApplyRun?.status === "writing_files" ||
    latestApplyRun?.status === "restarting_runtime" ||
    latestApplyRun?.status === "verifying_runtime" ||
    latestApplyRun?.status === "applying";

  if (!agent) {
    return {
      applyStatus: applyStatus ?? "Not available",
      detail: "Otto has not been provisioned for this workspace yet.",
      label: "Unavailable",
      slackStatus,
      title: "Otto is not ready",
      variant: "outline" as const,
      runtimeStatus,
    };
  }

  if (slackError || latestApplyFailed) {
    return {
      applyStatus: applyStatus ?? "Failed",
      detail:
        latestApplyRun?.error ??
        slackError ??
        "The latest update needs attention.",
      label: "Needs attention",
      slackStatus,
      title: "Otto needs attention",
      variant: "destructive" as const,
      runtimeStatus,
    };
  }

  if (latestApplyUpdating) {
    return {
      applyStatus: applyStatus ?? "Applying",
      detail: "Otto is applying a recent change for this workspace.",
      label: "Updating",
      slackStatus,
      title: "Otto is updating",
      variant: "outline" as const,
      runtimeStatus,
    };
  }

  if (!isOrganizationUnlocked(organization)) {
    return {
      applyStatus: applyStatus ?? "Not available",
      detail: "Finish setup so Otto can start helping in this workspace.",
      label: "Setup required",
      slackStatus,
      title: "Otto is still getting ready",
      variant: "outline" as const,
      runtimeStatus,
    };
  }

  return {
    applyStatus: applyStatus ?? "Applied",
    detail: "Otto is ready to help in this workspace.",
    label: "Ready",
    slackStatus,
    title: "Otto is ready",
    variant: "secondary" as const,
    runtimeStatus,
  };
}

export function isRuntimeReady(organization: DashboardOrganization) {
  const agent = getPrimaryAgent(organization);

  if (!agent) {
    return false;
  }

  return agent.status === "ready" && agent.serverStatus === "ready";
}

export function isOrganizationUnlocked(organization: DashboardOrganization) {
  return isOrganizationReady(organization) && isRuntimeReady(organization);
}

export function getOrganizationHomePath(organization: DashboardOrganization) {
  if (!isOrganizationReady(organization)) {
    return getPendingAccessPath(organization.slug);
  }

  if (isOrganizationUnlocked(organization)) {
    return `/${organization.slug}/agent/status`;
  }

  return `/${organization.slug}/onboarding`;
}

export function getSlackStatusLabel(organization: DashboardOrganization) {
  if (isSlackConnected(organization)) {
    return "Connected";
  }

  if (getSlackErrorMessage(organization)) {
    return "Needs attention";
  }

  return "Not connected";
}

export function getWhatsAppStatusLabel(organization: DashboardOrganization) {
  const status = organization.whatsappIntegration?.status;

  switch (status) {
    case "pending_apply":
      return "Preparing";
    case "applying":
      return "Applying";
    case "activating":
      return "Activating";
    case "ready_to_link":
      return "Ready to connect";
    case "linking":
      return "Waiting for scan";
    case "connected":
      return "Connected";
    case "apply_failed":
    case "link_failed":
      return "Needs attention";
    case "disconnected":
      return "Disconnected";
    default:
      return organization.whatsappIntegration ? "Pending" : "Not connected";
  }
}

export function getRuntimeStatusLabel(organization: DashboardOrganization) {
  const agent = getPrimaryAgent(organization);

  if (!agent) {
    return "Not ready";
  }

  if (agent.serverStatus === "ready" && agent.status === "ready") {
    return "Ready";
  }

  return "Setting up";
}
