import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import {
  getDashboardOrganizations,
  refreshTenantSlackDirectory,
} from "@/db/control-plane";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { user } = await withAuth({ ensureSignedIn: true });

    const organizations = await getDashboardOrganizations(user.id);
    const organization = organizations.find((o) => o.slug === orgSlug);

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    const result = await refreshTenantSlackDirectory({
      orgSlug,
      userExternalId: user.id,
    });

    if (result?.error) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to resync directory",
      },
      { status: 500 },
    );
  }
}
