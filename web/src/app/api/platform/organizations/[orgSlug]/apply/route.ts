import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import {
  syncUserFromSession,
  triggerPlatformOrganizationApply,
} from "@/db/control-plane";

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
    await syncUserFromSession(user);

    const result = await triggerPlatformOrganizationApply({
      orgSlug,
      userExternalId: user.id,
    });

    return json(result);
  } catch (error) {
    return handlePlatformRouteError(error);
  }
}

function handlePlatformRouteError(error: unknown) {
  if (
    error instanceof Error &&
    error.message === "Platform admin access required"
  ) {
    return json(
      {
        code: "forbidden",
        message: error.message,
      },
      403,
    );
  }

  if (error instanceof Error) {
    return json(
      {
        code: "platform_apply_failed",
        message: error.message,
      },
      400,
    );
  }

  return json(
    {
      code: "platform_apply_failed",
      message: "Platform apply failed.",
    },
    500,
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
