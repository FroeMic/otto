import type { DashboardOrganization } from "@/db/control-plane";

export function getPendingAccessPath(orgSlug?: string) {
  if (!orgSlug) {
    return "/onboarding/wait-for-access";
  }

  return `/onboarding/wait-for-access?orgSlug=${encodeURIComponent(orgSlug)}`;
}

export function getPrimaryAgent(organization: DashboardOrganization) {
  return organization.tenants[0] ?? null;
}

export function isOrganizationReady(organization: DashboardOrganization) {
  return organization.isReady;
}

export function getCurrentOnboardingSession(
  organization: DashboardOrganization,
) {
  if (organization.latestOnboardingSession?.slackConnectedAt) {
    return organization.latestOnboardingSession;
  }

  return organization.onboardingDraft ?? organization.latestOnboardingSession;
}

export function isSlackConnected(organization: DashboardOrganization) {
  return Boolean(
    organization.slackIntegration?.connectedAt ||
      organization.latestOnboardingSession?.slackConnectedAt ||
      organization.onboardingDraft?.slackConnectedAt,
  );
}

export function getSlackErrorMessage(organization: DashboardOrganization) {
  return (
    organization.slackIntegration?.lastError ||
    organization.onboardingDraft?.slackOauthError ||
    organization.latestOnboardingSession?.slackOauthError ||
    null
  );
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

export function isRuntimeReady(organization: DashboardOrganization) {
  const agent = getPrimaryAgent(organization);

  if (!agent) {
    return false;
  }

  return agent.status === "ready" && agent.serverStatus === "ready";
}

export function isOrganizationUnlocked(organization: DashboardOrganization) {
  return (
    isOrganizationReady(organization) &&
    isSlackConnected(organization) &&
    isRuntimeReady(organization)
  );
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

  if (organization.onboardingDraft || organization.latestOnboardingSession) {
    return "Pending";
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
