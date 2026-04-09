import type { SlackIngressRequestType } from "../db/control-plane";
import { handleSlackIngressRequest } from "../integrations/library/slack/ingress/handler";

export async function handleSlackIngressRoute(
  request: Request,
  requestType: SlackIngressRequestType,
) {
  return await handleSlackIngressRequest(request, requestType);
}
