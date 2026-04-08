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
  const startedAt = Date.now();
  try {
    console.info("[platform/apply-route] request start");
    const { user } = await withAuth({ ensureSignedIn: true });
    console.info("[platform/apply-route] withAuth complete", {
      durationMs: Date.now() - startedAt,
      userExternalId: user.id,
    });
    const { orgSlug } = await context.params;
    await syncUserFromSession(user);
    console.info("[platform/apply-route] syncUserFromSession complete", {
      durationMs: Date.now() - startedAt,
      orgSlug,
      userExternalId: user.id,
    });

    const result = await triggerPlatformOrganizationApply({
      orgSlug,
      userExternalId: user.id,
    });

    console.info("[platform/apply-route] request complete", {
      durationMs: Date.now() - startedAt,
      jobId: result.jobId,
      orgSlug,
      userExternalId: user.id,
    });

    return json(result);
  } catch (error) {
    console.error("[platform/apply-route] request failed", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    });
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
