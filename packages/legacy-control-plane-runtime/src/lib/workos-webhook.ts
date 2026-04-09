import { NextResponse } from "next/server";

import {
  reconcileWorkspaceMembershipProjectionForUser,
  syncOrganizationProjectionFromWorkOS,
} from "../db/control-plane";
import { getEnv } from "./env";
import { getWorkOS } from "./workos";

type WorkOSWebhookEvent = {
  data: Record<string, unknown>;
  event: string;
  id?: string;
};

function getWebhookSignatureHeader(headers: Headers) {
  return (
    headers.get("workos-signature") ??
    headers.get("x-workos-signature") ??
    headers.get("webhook-signature")
  );
}

async function verifyWorkOSWebhookWithSdk(input: {
  rawPayload: string;
  secret: string;
  sigHeader: string;
}) {
  const workos = getWorkOS();
  const payload = JSON.parse(input.rawPayload) as Record<string, unknown>;

  return (await workos.webhooks.constructEvent({
    payload,
    secret: input.secret,
    sigHeader: input.sigHeader,
  })) as WorkOSWebhookEvent;
}

export async function handleWorkOSWebhookRequest(request: Request) {
  const secret = getEnv().WORKOS_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "WorkOS webhook secret is not configured" },
      { status: 501 },
    );
  }

  const sigHeader = getWebhookSignatureHeader(request.headers);

  if (!sigHeader) {
    return NextResponse.json(
      { ok: false, error: "Missing WorkOS signature header" },
      { status: 400 },
    );
  }

  const rawPayload = await request.text();

  try {
    const event = await verifyWorkOSWebhookWithSdk({
      rawPayload,
      secret,
      sigHeader,
    });

    console.info("[workos] webhook verified", {
      event: event.event,
      id: event.id ?? null,
      payloadLength: rawPayload.length,
      signatureHeaderPrefix: sigHeader.slice(0, 32),
    });

    switch (event.event) {
      case "organization_membership.created":
      case "organization_membership.deleted":
      case "organization_membership.updated":
        if (typeof event.data.userId === "string") {
          await reconcileWorkspaceMembershipProjectionForUser(
            event.data.userId,
          );
        }
        break;
      case "organization.updated":
        if (
          typeof event.data.id === "string" &&
          typeof event.data.name === "string"
        ) {
          await syncOrganizationProjectionFromWorkOS({
            organization: {
              id: event.data.id,
              name: event.data.name,
            },
          });
        }
        break;
      default:
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process WorkOS webhook",
      },
      { status: 400 },
    );
  }
}
