import { withAuth } from "@workos-inc/authkit-nextjs";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import {
  getPlatformOrganizationDetail,
  hasPlatformAdminRole,
  syncUserFromSession,
} from "@/db/control-plane";
import { jobRuns } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; jobId: string }> },
) {
  try {
    const { orgSlug, jobId } = await params;
    const { user } = await withAuth({ ensureSignedIn: true });
    await syncUserFromSession(user);

    const isAdmin = await hasPlatformAdminRole(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Platform admin access required" },
        { status: 403 },
      );
    }

    const organization = await getPlatformOrganizationDetail({
      orgSlug,
      userExternalId: user.id,
    });

    if (!organization?.tenant) {
      return NextResponse.json(
        { error: "Organization or tenant not found" },
        { status: 404 },
      );
    }

    const db = getDb();
    const [job] = await db
      .select({
        id: jobRuns.id,
        status: jobRuns.status,
        error: jobRuns.error,
        finishedAt: jobRuns.finishedAt,
      })
      .from(jobRuns)
      .where(
        and(
          eq(jobRuns.id, jobId),
          eq(jobRuns.tenantId, organization.tenant.id),
        ),
      )
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      status: job.status,
      error: job.error,
      finishedAt: job.finishedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to get job status",
      },
      { status: 500 },
    );
  }
}
