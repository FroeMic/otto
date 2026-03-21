import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { getCurrentTenantWhatsAppLinkSession } from "@/db/control-plane";

export const dynamic = "force-dynamic";

export async function GET(
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
    const linkSession = await getCurrentTenantWhatsAppLinkSession({
      orgSlug,
      userExternalId: user.id,
    });

    return NextResponse.json(
      {
        linkSession,
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
        code: "whatsapp_link_session_fetch_failed",
        message:
          error instanceof Error
            ? error.message
            : "Could not load the current WhatsApp link session",
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
