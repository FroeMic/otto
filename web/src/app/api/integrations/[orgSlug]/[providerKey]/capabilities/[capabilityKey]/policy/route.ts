import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { updateManagedIntegrationCapabilityPolicy } from "@/db/control-plane";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      capabilityKey: string;
      orgSlug: string;
      providerKey: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { capabilityKey, orgSlug, providerKey } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      policy?: "allow" | "block";
    } | null;

    if (body?.policy !== "allow" && body?.policy !== "block") {
      throw new Error("Capability policy must be allow or block.");
    }

    const row = await updateManagedIntegrationCapabilityPolicy({
      capabilityKey: decodeURIComponent(capabilityKey),
      orgSlug,
      policy: {
        policy: body.policy,
      },
      providerKey,
      userExternalId: user.id,
    });

    return NextResponse.json(
      {
        row,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        code: "managed_integration_capability_policy_update_failed",
        message:
          error instanceof Error
            ? error.message
            : "Capability policy update failed",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
        status: 400,
      },
    );
  }
}
