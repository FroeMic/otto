import crypto from "node:crypto";

import { getNangoConfig } from "@/lib/env";

type NangoConnectSessionResponse = {
  data?: {
    connect_link?: string;
    expires_at?: string;
    token?: string;
  };
  error?: {
    message?: string;
  };
  message?: string;
};

type CreateConnectSessionInput = {
  connectionId?: string;
  integrationId: string;
  organizationDisplayName: string;
  organizationId: string;
  userEmail: string;
  userExternalId: string;
};

type NangoWebhookError = {
  description?: string;
  type?: string;
};

type NangoWebhookPayload = {
  authMode?: string;
  connectionId?: string;
  endUser?: {
    email?: string;
    organizationId?: string;
    organizationName?: string;
    tags?: Record<string, string>;
    userId?: string;
  };
  error?: NangoWebhookError;
  operation?: string;
  provider?: string;
  providerConfigKey?: string;
  success?: boolean;
  tags?: Record<string, string>;
  type?: string;
};

export type VerifiedNangoWebhook = {
  payload: NangoWebhookPayload;
  rawBody: string;
};

export async function createNangoConnectSession(
  input: CreateConnectSessionInput,
) {
  const config = getNangoConfig();
  const endpoint = input.connectionId
    ? `${config.apiBaseUrl}/connect/sessions/reconnect`
    : `${config.apiBaseUrl}/connect/sessions`;
  const response = await fetch(endpoint, {
    body: JSON.stringify({
      ...(input.connectionId
        ? {
            connection_id: input.connectionId,
            integration_id: input.integrationId,
          }
        : {
            allowed_integrations: [input.integrationId],
          }),
      tags: {
        end_user_email: input.userEmail,
        end_user_id: input.userExternalId,
        organization_id: input.organizationId,
        organization_name: input.organizationDisplayName,
      },
    }),
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = (await response.json()) as NangoConnectSessionResponse;

  if (!response.ok || !payload.data?.token) {
    throw new Error(
      payload.error?.message ??
        payload.message ??
        "Nango could not create a connect session.",
    );
  }

  return {
    connectLink: payload.data.connect_link ?? null,
    expiresAt: payload.data.expires_at ?? null,
    token: payload.data.token,
  };
}

export async function verifyNangoWebhookRequest(
  request: Request,
): Promise<VerifiedNangoWebhook> {
  const signature = request.headers.get("X-Nango-Hmac-Sha256");

  if (!signature) {
    throw new Error("Missing Nango webhook signature.");
  }

  const rawBody = await request.text();
  const expectedSignature = crypto
    .createHmac("sha256", getNangoConfig().webhookSecret)
    .update(rawBody)
    .digest("hex");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid Nango webhook signature.");
  }

  return {
    payload: JSON.parse(rawBody) as NangoWebhookPayload,
    rawBody,
  };
}

export function isNangoAuthCreationOrOverrideEvent(
  payload: NangoWebhookPayload,
) {
  return (
    payload.type === "auth" &&
    (payload.operation === "creation" || payload.operation === "override")
  );
}

export function isNangoAuthRefreshFailureEvent(payload: NangoWebhookPayload) {
  return (
    payload.type === "auth" &&
    payload.operation === "refresh" &&
    payload.success === false
  );
}

export function getNangoWebhookTag(
  payload: NangoWebhookPayload,
  key: string,
): string | null {
  const normalizedKey = key.trim().toLowerCase();

  return (
    payload.tags?.[normalizedKey] ??
    payload.endUser?.tags?.[normalizedKey] ??
    null
  );
}

export function getNangoWebhookErrorMessage(payload: NangoWebhookPayload) {
  return (
    payload.error?.description ??
    payload.error?.type ??
    "The Linear connection needs attention."
  );
}
