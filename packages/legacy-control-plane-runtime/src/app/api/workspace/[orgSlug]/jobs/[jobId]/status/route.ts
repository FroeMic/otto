import { withAuth } from "@workos-inc/authkit-nextjs";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "../../../../../../../db/client";
import { getDashboardOrganizations } from "../../../../../../../db/control-plane";
import { jobRuns } from "../../../../../../../db/schema";
import { getPrimaryAgent } from "../../../../../../../lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; jobId: string }> },
) {
  try {
    const { orgSlug, jobId } = await params;
    const { user } = await withAuth({ ensureSignedIn: true });

    const organizations = await getDashboardOrganizations(user.id);
    const organization = organizations.find(
      (candidate) => candidate.slug === orgSlug,
    );

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    const agent = getPrimaryAgent(organization);
    if (!agent) {
      return NextResponse.json(
        { error: "No tenant found for organization" },
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
      .where(and(eq(jobRuns.id, jobId), eq(jobRuns.tenantId, agent.id)))
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
