import { handleSlackIngressRequest } from "../library/slack/ingress/handler";
import type { SlackIngressRequestType } from "../library/slack/ingress/types";

import { getIntegrationDefinition } from "./registry";

type IngressHandlerInput = {
  endpointKey: string;
  provider: string;
  request: Request;
};

export async function dispatchIntegrationIngressRequest(
  input: IngressHandlerInput,
) {
  const definition = getIntegrationDefinition(input.provider);

  if (!definition?.ingress) {
    return Response.json(
      {
        error: `Unsupported integration ingress provider: ${input.provider}`,
      },
      { status: 404 },
    );
  }

  const endpoint = definition.ingress.endpoints.find(
    (candidate) => candidate.endpointKey === input.endpointKey,
  );

  if (!endpoint) {
    return Response.json(
      {
        error: `Unsupported ${input.provider} ingress endpoint: ${input.endpointKey}`,
      },
      { status: 404 },
    );
  }

  switch (definition.key) {
    case "slack":
      return await handleSlackIngressRequest(
        input.request,
        endpoint.endpointKey as SlackIngressRequestType,
      );
    default:
      return Response.json(
        {
          error: `No ingress handler is registered for provider: ${input.provider}`,
        },
        { status: 501 },
      );
  }
}
