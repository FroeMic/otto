import { handleStripeWebhookRequest } from "../../../lib/billing/stripe-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleStripeWebhookRequest(request);
}
