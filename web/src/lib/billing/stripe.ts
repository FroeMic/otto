import Stripe from "stripe";

import { getStripeSecretKey } from "@/lib/env";

let cachedStripe: Stripe | null = null;

export function getStripe() {
  if (cachedStripe) {
    return cachedStripe;
  }

  cachedStripe = new Stripe(getStripeSecretKey(), {
    maxNetworkRetries: 2,
  });

  return cachedStripe;
}
