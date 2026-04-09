import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { updateTenantSlackChannelMembership } from "../../../../../../../../db/control-plane";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["join", "leave"]),
});

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      channelId: string;
      orgSlug: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { channelId, orgSlug } = await context.params;
    const body = bodySchema.parse(await request.json());
    const result = await updateTenantSlackChannelMembership({
      action: body.action,
      channelId,
      orgSlug,
      userExternalId: user.id,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "schema_invalid",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid Slack channel membership payload",
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
          status: 400,
        },
      );
    }

    return NextResponse.json(
      {
        code: "slack_channel_membership_failed",
        message:
          error instanceof Error
            ? error.message
            : "Slack channel membership update failed",
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
