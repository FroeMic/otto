import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { reapplyTenantToolSurface } from "../../../../../../../../db/control-plane";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  summary: z.string().trim().min(1).max(500).optional(),
});

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      orgSlug: string;
      surfaceKey: string;
      surfaceKind: string;
    }>;
  },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug, surfaceKey, surfaceKind } = await context.params;
    const body = bodySchema.parse(await request.json());
    const result = await reapplyTenantToolSurface({
      createdByType: "user",
      orgSlug,
      summary: body.summary,
      surfaceKey,
      surfaceKind,
      userExternalId: user.id,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "schema_invalid",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid reapply payload",
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
          status: 400,
        },
      );
    }

    return NextResponse.json(
      {
        code: "runtime_surface_reapply_failed",
        message:
          error instanceof Error
            ? error.message
            : "Runtime surface reapply failed",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
        status: 400,
      },
    );
  }
}
