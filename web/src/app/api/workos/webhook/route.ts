import { NextResponse } from "next/server";

import {
  reconcileWorkspaceMembershipProjectionForUser,
  syncOrganizationProjectionFromWorkOS,
} from "@/db/control-plane";
import { getEnv } from "@/lib/env";
import { getWorkOS } from "@/lib/workos";

export const dynamic = "force-dynamic";

function getWebhookSignatureHeader(headers: Headers) {
  return (
    headers.get("workos-signature") ??
    headers.get("x-workos-signature") ??
    headers.get("webhook-signature")
  );
}

export async function POST(request: Request) {
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
    const workos = getWorkOS();
    const payload = JSON.parse(rawPayload) as Record<string, unknown>;
    const event = await workos.webhooks.constructEvent({
      payload,
      secret,
      sigHeader,
    });

    switch (event.event) {
      case "organization_membership.created":
      case "organization_membership.deleted":
      case "organization_membership.updated":
        await reconcileWorkspaceMembershipProjectionForUser(event.data.userId);
        break;
      case "organization.updated":
        await syncOrganizationProjectionFromWorkOS({
          organization: event.data,
        });
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
