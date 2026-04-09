import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import {
  getDashboardOrganizations,
  hasPlatformAdminRole,
  syncUserFromSession,
} from "@/db/control-plane";

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

  try {
    await syncUserFromSession(user);

    const [organizations, isPlatformAdmin] = await Promise.all([
      getDashboardOrganizations(user.id),
      hasPlatformAdminRole(user.id),
    ]);

    const currentOrganization = organizations.find(
      (organization) => organization.slug === orgSlug,
    );

    if (!currentOrganization) {
      return json(
        {
          code: "organization_not_found",
          message: "Organization not found.",
        },
        404,
      );
    }

    return json({
      currentOrganization,
      organizations,
      user: {
        email: user.email,
        id: user.id,
        isPlatformAdmin,
        name:
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.email,
      },
    });
  } catch (error) {
    return json(
      {
        code: "bootstrap_failed",
        message:
          error instanceof Error ? error.message : "Failed to load workspace.",
      },
      400,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
