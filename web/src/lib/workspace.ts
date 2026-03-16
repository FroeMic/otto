import type { DashboardOrganization } from "@/db/control-plane";

export function getPrimaryAgent(organization: DashboardOrganization) {
  return organization.tenants[0] ?? null;
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

export function isRuntimeReady(organization: DashboardOrganization) {
  const agent = getPrimaryAgent(organization);

  if (!agent) {
    return false;
  }

  return agent.status === "ready" && agent.serverStatus === "ready";
}

export function isOrganizationUnlocked(organization: DashboardOrganization) {
  return isSlackConnected(organization) && isRuntimeReady(organization);
}

export function getOrganizationHomePath(organization: DashboardOrganization) {
  if (isOrganizationUnlocked(organization)) {
    return `/${organization.slug}/agent`;
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
