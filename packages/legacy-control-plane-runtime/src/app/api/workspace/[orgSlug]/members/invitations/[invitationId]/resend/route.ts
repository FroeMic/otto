import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import {
  resendWorkspaceInvitation,
  syncUserFromSession,
} from "../../../../../../../../db/control-plane";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      invitationId: string;
      orgSlug: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { invitationId, orgSlug } = await context.params;
    await syncUserFromSession(user);

    const result = await resendWorkspaceInvitation({
      invitationId,
      orgSlug,
      userExternalId: user.id,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Workspace invitation resend failed";
    const status =
      message === "You do not have access to this organization" ||
      message === "Workspace admin access required"
        ? 403
        : message === "Workspace invitation not found"
          ? 404
          : 400;

    return NextResponse.json(
      {
        code: "workspace_invitation_resend_failed",
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
