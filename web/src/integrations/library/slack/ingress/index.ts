import type { SlackIngressRequestType } from "@/db/control-plane";
import type { IntegrationIngressDefinition } from "@/integrations/framework";

export type SlackIngressEndpointKey = SlackIngressRequestType;

const SLACK_ENDPOINTS = [
  {
    description:
      "Receive Slack Events API deliveries for the shared Otto Slack app.",
    endpointKey: "events",
    label: "Events",
  },
  {
    description:
      "Receive Slack slash command invocations for the shared Otto Slack app.",
    endpointKey: "commands",
    label: "Slash commands",
  },
  {
    description:
      "Receive Slack interactivity payloads for the shared Otto Slack app.",
    endpointKey: "interactivity",
    label: "Interactivity",
  },
] as const satisfies IntegrationIngressDefinition["endpoints"];

export const slackIngressDefinition: IntegrationIngressDefinition = {
  endpoints: [...SLACK_ENDPOINTS],
  setupMode: "platform_managed",
};

export function getSlackIngressFrameworkPath(
  endpointKey: SlackIngressEndpointKey,
) {
  return `/api/webhooks/integrations/slack/${endpointKey}`;
}

export function getSlackIngressCompatibilityPath(
  endpointKey: SlackIngressEndpointKey,
) {
  return `/api/integrations/slack/${endpointKey}`;
}

export function getSlackIngressEndpoint(endpointKey: SlackIngressEndpointKey) {
  const endpoint = SLACK_ENDPOINTS.find(
    (candidate) => candidate.endpointKey === endpointKey,
  );

  if (!endpoint) {
    throw new Error(`Unsupported Slack ingress endpoint: ${endpointKey}`);
  }

  return {
    compatibilityPath: getSlackIngressCompatibilityPath(endpoint.endpointKey),
    endpointKey: endpoint.endpointKey,
    frameworkPath: getSlackIngressFrameworkPath(endpoint.endpointKey),
    label: endpoint.label,
  };
}
