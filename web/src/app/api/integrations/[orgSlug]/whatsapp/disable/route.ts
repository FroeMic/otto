import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { disableTenantWhatsAppIntegration } from "@/db/control-plane";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug } = await context.params;
    const result = await disableTenantWhatsAppIntegration({
      orgSlug,
      userExternalId: user.id,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "whatsapp_disable_failed",
        message:
          error instanceof Error ? error.message : "WhatsApp disable failed",
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
