import { NextResponse } from "next/server";

import {
  completeLinearNangoConnection,
  recordLinearNangoRefreshFailure,
} from "@/db/control-plane";
import { getNangoConfig } from "@/lib/env";
import {
  getNangoWebhookErrorMessage,
  getNangoWebhookTag,
  isNangoAuthCreationOrOverrideEvent,
  isNangoAuthRefreshFailureEvent,
  verifyNangoWebhookRequest,
} from "@/lib/nango";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { payload } = await verifyNangoWebhookRequest(request);

    if (payload.providerConfigKey !== getNangoConfig().linearIntegrationId) {
      return json({
        ignored: true,
        received: true,
      });
    }

    const organizationId = getNangoWebhookTag(payload, "organization_id");

    if (!organizationId) {
      throw new Error("Missing organization_id in Nango webhook tags.");
    }

    if (
      isNangoAuthCreationOrOverrideEvent(payload) &&
      payload.success !== false &&
      payload.connectionId &&
      payload.providerConfigKey
    ) {
      await completeLinearNangoConnection({
        connectedByUserExternalId: getNangoWebhookTag(payload, "end_user_id"),
        connectionId: payload.connectionId,
        nangoIntegrationId: payload.providerConfigKey,
        organizationId,
      });

      return json({
        received: true,
      });
    }

    if (
      isNangoAuthRefreshFailureEvent(payload) ||
      (isNangoAuthCreationOrOverrideEvent(payload) && payload.success === false)
    ) {
      await recordLinearNangoRefreshFailure({
        error: getNangoWebhookErrorMessage(payload),
        organizationId,
      });

      return json({
        received: true,
      });
    }

    return json({
      ignored: true,
      received: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Nango webhook handling failed.",
      },
      {
        status: 400,
      },
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}
