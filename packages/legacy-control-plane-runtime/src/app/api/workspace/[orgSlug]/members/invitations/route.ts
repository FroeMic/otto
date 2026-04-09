import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  inviteWorkspaceMembers,
  syncUserFromSession,
} from "../../../../../../db/control-plane";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  emails: z.array(z.string().trim().email()).min(1),
  roleSlug: z.string().trim().min(1),
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
    await syncUserFromSession(user);

    const result = await inviteWorkspaceMembers({
      emails: body.emails,
      orgSlug,
      roleSlug: body.roleSlug,
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
          message: "Invalid workspace member payload",
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
          status: 400,
        },
      );
    }

    const message =
      error instanceof Error ? error.message : "Workspace invite failed";
    const status =
      message === "You do not have access to this organization" ||
      message === "Workspace admin access required"
        ? 403
        : 400;

    return NextResponse.json(
      {
        code: "workspace_invite_failed",
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
}
