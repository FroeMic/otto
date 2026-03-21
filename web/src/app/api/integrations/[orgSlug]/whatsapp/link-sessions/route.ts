import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createTenantWhatsAppLinkSession } from "@/db/control-plane";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  forceRelink: z.boolean().optional(),
});

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug } = await context.params;
    const body = bodySchema.parse(await request.json());
    const result = await createTenantWhatsAppLinkSession({
      forceRelink: body.forceRelink,
      orgSlug,
      userExternalId: user.id,
    });

    return json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        "schema_invalid",
        "Invalid WhatsApp link session payload",
        400,
        z.flattenError(error).fieldErrors,
      );
    }

    return errorResponse(
      "whatsapp_link_session_failed",
      error instanceof Error
        ? error.message
        : "WhatsApp link session could not be created",
      400,
    );
  }
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  fieldErrors?: Record<string, string[] | undefined>,
) {
  return NextResponse.json(
    {
      code,
      ...(fieldErrors ? { fieldErrors } : {}),
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
