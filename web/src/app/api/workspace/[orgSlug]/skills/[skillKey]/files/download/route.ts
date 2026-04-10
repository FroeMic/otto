import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { getDashboardOrganizations } from "@/db/control-plane";
import { getLatestTenantManagedSkillDetailForTenant } from "@/db/managed-skills";
import { getTenantRuntimeConnection } from "@/lib/runtime/connection";
import {
  downloadRuntimePath,
  type RuntimeDownloadKind,
} from "@/lib/runtime/file-download";
import { getPrimaryAgent } from "@/lib/workspace";

const MANAGED_SKILL_WORKSPACE_ROOT = "/opt/openclaw/home/workspace/skills";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
      skillKey: string;
    }>;
  },
) {
  try {
    const { orgSlug, skillKey } = await context.params;
    const { user } = await withAuth({ ensureSignedIn: true });
    const organizations = await getDashboardOrganizations(user.id);
    const organization = organizations.find(
      (candidate) => candidate.slug === orgSlug,
    );

    if (!organization) {
      return NextResponse.json(
        {
          code: "not_found",
          message: "Workspace not found.",
        },
        { status: 404 },
      );
    }

    const agent = getPrimaryAgent(organization);

    if (!agent) {
      return NextResponse.json(
        {
          code: "runtime_unavailable",
          message: "This workspace does not have a tenant runtime yet.",
        },
        { status: 404 },
      );
    }

    const detail = await getLatestTenantManagedSkillDetailForTenant({
      skillKey,
      tenantId: agent.id,
    });

    if (!detail) {
      return NextResponse.json(
        {
          code: "not_found",
          message: "Managed skill not found.",
        },
        { status: 404 },
      );
    }

    const url = new URL(request.url);
    const relativePath = url.searchParams.get("path") ?? "";
    const kind = normalizeDownloadKind(url.searchParams.get("kind"));
    const disposition = normalizeDisposition(
      url.searchParams.get("disposition"),
    );
    const connection = await getTenantRuntimeConnection(
      agent.id,
      `GET /api/workspace/${orgSlug}/skills/${detail.skillKey}/files/download`,
    );
    const download = await downloadRuntimePath({
      connection,
      kind,
      relativePath,
      rootPath: `${MANAGED_SKILL_WORKSPACE_ROOT}/${detail.skillKey}`,
    });

    return new NextResponse(new Uint8Array(download.bytes), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `${disposition}; filename="${download.downloadName}"`,
        "Content-Length": String(download.bytes.byteLength),
        "Content-Type": download.contentType,
      },
      status: 200,
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "skill_file_download_failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to download skill file.",
      },
      { status: 500 },
    );
  }
}

function normalizeDownloadKind(value: string | null): RuntimeDownloadKind {
  return value === "directory" ? "directory" : "file";
}

function normalizeDisposition(value: string | null) {
  return value === "inline" ? "inline" : "attachment";
}
