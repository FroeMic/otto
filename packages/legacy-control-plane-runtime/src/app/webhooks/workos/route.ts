import { handleWorkOSWebhookRequest } from "../../../lib/workos-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleWorkOSWebhookRequest(request);
}
