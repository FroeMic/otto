import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { getDashboardOrganizations } from "@/db/control-plane";
import { getTenantRuntimeConnection } from "@/lib/runtime/connection";
import {
  downloadRuntimePath,
  type RuntimeDownloadKind,
} from "@/lib/runtime/file-download";
import { getPrimaryAgent } from "@/lib/workspace";

const WORKSPACE_ROOT = "/opt/openclaw/home/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
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

    const url = new URL(request.url);
    const relativePath = url.searchParams.get("path") ?? "";
    const kind = normalizeDownloadKind(url.searchParams.get("kind"));
    const disposition = normalizeDisposition(
      url.searchParams.get("disposition"),
    );
    const connection = await getTenantRuntimeConnection(
      agent.id,
      `GET /api/workspace/${orgSlug}/files/download`,
    );
    const download = await downloadRuntimePath({
      connection,
      kind,
      relativePath,
      rootPath: WORKSPACE_ROOT,
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
        code: "workspace_file_download_failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to download workspace file.",
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
