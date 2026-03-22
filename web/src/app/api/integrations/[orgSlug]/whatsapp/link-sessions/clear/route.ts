import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { clearCurrentTenantWhatsAppLinkSession } from "@/db/control-plane";

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
    const result = await clearCurrentTenantWhatsAppLinkSession({
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
        code: "whatsapp_link_session_clear_failed",
        message:
          error instanceof Error
            ? error.message
            : "Could not clear the current WhatsApp link session",
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
