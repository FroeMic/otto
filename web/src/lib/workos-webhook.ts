import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  reconcileWorkspaceMembershipProjectionForUser,
  syncOrganizationProjectionFromWorkOS,
} from "@/db/control-plane";
import { getEnv } from "@/lib/env";

function getWebhookSignatureHeader(headers: Headers) {
  return (
    headers.get("workos-signature") ??
    headers.get("x-workos-signature") ??
    headers.get("webhook-signature")
  );
}

function verifyWorkOSWebhookSignature(input: {
  rawPayload: string;
  secret: string;
  sigHeader: string;
  toleranceMs?: number;
}) {
  const toleranceMs = input.toleranceMs ?? 3 * 60 * 1000;
  const headerParts = new Map(
    input.sigHeader.split(",").map((part) => {
      const [key, value] = part.trim().split("=", 2);
      return [key, value];
    }),
  );
  const timestamp = headerParts.get("t");
  const signature = headerParts.get("v1");

  if (!timestamp || !signature) {
    throw new Error("Signature or timestamp missing");
  }

  const timestampMs = Number.parseInt(timestamp, 10);

  if (!Number.isFinite(timestampMs)) {
    throw new Error("Invalid WorkOS signature timestamp");
  }

  if (timestampMs < Date.now() - toleranceMs) {
    throw new Error("Timestamp outside the tolerance zone");
  }

  const expectedSignature = createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.rawPayload}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const actualBuffer = Buffer.from(signature, "utf8");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error(
      "Signature hash does not match the expected signature hash for payload",
    );
  }
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
    verifyWorkOSWebhookSignature({
      rawPayload,
      secret,
      sigHeader,
    });

    const event = JSON.parse(rawPayload) as {
      data: Record<string, unknown>;
      event: string;
    };

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
