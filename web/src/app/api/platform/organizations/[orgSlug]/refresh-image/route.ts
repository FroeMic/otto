import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import {
  getPlatformTenantTarget,
  syncUserFromSession,
} from "@/db/control-plane";
import { getTenantRuntimeConnection } from "@/lib/runtime/connection";
import { RuntimeManager } from "@/lib/runtime/manager";

export const dynamic = "force-dynamic";

const runtimeManager = new RuntimeManager();

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

    const tenant = await getPlatformTenantTarget({
      orgSlug,
      userExternalId: user.id,
    });

    if (!tenant) {
      throw new Error("Organization tenant not found");
    }

    const runtimeConnection = await getTenantRuntimeConnection(
      tenant.tenantId,
      "platform admin image refresh",
    );
    const restart =
      await runtimeManager.restartGatewayWithResult(runtimeConnection);
    const verify =
      await runtimeManager.checkGatewayHealthWithResult(runtimeConnection);

    return json({
      restartStderr: restart.stderr,
      restartStdout: restart.stdout,
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      verifyStderr: verify.stderr,
      verifyStdout: verify.stdout,
    });
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
        code: "platform_refresh_failed",
        message: error.message,
      },
      400,
    );
  }

  return json(
    {
      code: "platform_refresh_failed",
      message: "Platform image refresh failed.",
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
