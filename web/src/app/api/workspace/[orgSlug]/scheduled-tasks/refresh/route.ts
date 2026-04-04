import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { getDashboardOrganizations } from "@/db/control-plane";
import { enqueueJob } from "@/lib/jobs/queue";
import { JOB_TYPES } from "@/lib/jobs/types";
import { getPrimaryAgent } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
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

    const jobId = await enqueueJob({
      jobType: JOB_TYPES.reconcileTenantScheduledTasks,
      payload: { tenantId: agent.id },
    });

    return NextResponse.json({ ok: true, jobId });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to queue scheduled task refresh",
      },
      { status: 500 },
    );
  }
}
