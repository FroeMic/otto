import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import {
  reactivateWorkspaceMember,
  syncUserFromSession,
} from "../../../../../../../db/control-plane";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      membershipId: string;
      orgSlug: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { membershipId, orgSlug } = await context.params;
    await syncUserFromSession(user);

    const result = await reactivateWorkspaceMember({
      membershipId,
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
        : "Workspace member reactivation failed";
    const status =
      message === "You do not have access to this organization" ||
      message === "Workspace admin access required"
        ? 403
        : message === "Workspace member not found"
          ? 404
          : 400;

    return NextResponse.json(
      {
        code: "workspace_member_reactivate_failed",
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
