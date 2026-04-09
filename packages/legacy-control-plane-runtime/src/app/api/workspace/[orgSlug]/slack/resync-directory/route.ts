import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

import { getDashboardOrganizations } from "../../../../../../db/control-plane";
import { enqueueJob } from "../../../../../../lib/jobs/queue";
import { JOB_TYPES } from "../../../../../../lib/jobs/types";
import { getPrimaryAgent } from "../../../../../../lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { user } = await withAuth({ ensureSignedIn: true });
    const body = (await request.json()) as { action?: string };

    const organizations = await getDashboardOrganizations(user.id);
    const organization = organizations.find((o) => o.slug === orgSlug);

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

    const action = body.action;

    if (action === "users") {
      const jobId = await enqueueJob({
        jobType: JOB_TYPES.resyncSlackUsers,
        payload: { tenantId: agent.id },
      });
      return NextResponse.json({ ok: true, jobId });
    }

    if (action === "channels") {
      const jobId = await enqueueJob({
        jobType: JOB_TYPES.resyncSlackChannels,
        payload: { tenantId: agent.id },
      });
      return NextResponse.json({ ok: true, jobId });
    }

    return NextResponse.json(
      { error: "action must be 'users' or 'channels'" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to enqueue resync job",
      },
      { status: 500 },
    );
  }
}
