import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { listTenantRuntimeConfigSurfaces } from "@/db/control-plane";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
    }>;
  },
) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug } = await context.params;
  const surfaces = await listTenantRuntimeConfigSurfaces({
    orgSlug,
    userExternalId: user.id,
  });

  return json({
    surfaces,
  });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}
