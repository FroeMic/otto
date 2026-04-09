import { dispatchIntegrationIngressRequest } from "../../../../../../integrations/framework/ingress";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      endpointKey: string;
      provider: string;
    }>;
  },
) {
  const params = await context.params;

  return await dispatchIntegrationIngressRequest({
    endpointKey: params.endpointKey,
    provider: params.provider,
    request,
  });
}
