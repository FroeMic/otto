import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { enableTenantWhatsAppIntegration } from "../../../../../../db/control-plane";

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
    const result = await enableTenantWhatsAppIntegration({
      orgSlug,
      userExternalId: user.id,
    });

    return json(result);
  } catch (error) {
    return errorResponse(
      "whatsapp_enable_failed",
      error instanceof Error ? error.message : "WhatsApp enable failed",
      400,
    );
  }
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      code,
      message,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
      status,
    },
  );
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}
