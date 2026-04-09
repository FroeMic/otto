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
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug } = await context.params;
    await syncUserFromSession(user);

    const [organizations, isPlatformAdmin] = await Promise.all([
      getDashboardOrganizations(user.id),
      hasPlatformAdminRole(user.id),
    ]);

    const currentOrganization = organizations.find(
      (organization) => organization.slug === orgSlug,
    );

    if (!currentOrganization) {
      return NextResponse.json(
        {
          code: "organization_not_found",
          message: "Organization not found.",
        },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
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
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        code: "bootstrap_failed",
        message:
          error instanceof Error ? error.message : "Failed to load workspace.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
