import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getWorkOS } from "../../../../lib/workos";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim(),
});

export async function POST(request: Request) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const body = bodySchema.parse(await request.json());
    const workos = getWorkOS();

    const updatedUser = await workos.userManagement.updateUser({
      userId: user.id,
      firstName: body.firstName,
      lastName: body.lastName,
    });

    return NextResponse.json(
      {
        name: [updatedUser.firstName, updatedUser.lastName]
          .filter(Boolean)
          .join(" "),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "schema_invalid",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid profile payload",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const message =
      error instanceof Error ? error.message : "Profile update failed";

    return NextResponse.json(
      { code: "profile_update_failed", message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
