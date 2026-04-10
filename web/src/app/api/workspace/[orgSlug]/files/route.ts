import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { getDashboardOrganizations } from "@/db/control-plane";
import { getTenantRuntimeConnection } from "@/lib/runtime/connection";
import { getWorkspaceDirectorySnapshot } from "@/lib/runtime/workspace-files";
import { getPrimaryAgent } from "@/lib/workspace";

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
    const { orgSlug } = await context.params;
    const { user } = await withAuth({ ensureSignedIn: true });
    const organizations = await getDashboardOrganizations(user.id);
    const organization = organizations.find(
      (candidate) => candidate.slug === orgSlug,
    );

    if (!organization) {
      return json(
        {
          code: "not_found",
          message: "Workspace not found.",
        },
        404,
      );
    }

    const agent = getPrimaryAgent(organization);

    if (!agent) {
      return json(
        {
          code: "runtime_unavailable",
          message: "This workspace does not have a tenant runtime yet.",
        },
        404,
      );
    }

    const connection = await getTenantRuntimeConnection(
      agent.id,
      `GET /api/workspace/${orgSlug}/files`,
    );
    const snapshot = await getWorkspaceDirectorySnapshot({
      connection,
    });

    return json({
      ok: true,
      snapshot,
    });
  } catch (error) {
    return json(
      {
        code: "workspace_files_fetch_failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load workspace files.",
      },
      500,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
