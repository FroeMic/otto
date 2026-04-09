import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { upsertBillingPreferences } from "../../../../../../db/billing";
import {
  getOrganizationWorkspaceBySlug,
  syncUserFromSession,
} from "../../../../../../db/control-plane";
import { getAutoTopOffPacks } from "../../../../../../lib/billing/plans";

export const dynamic = "force-dynamic";

const allowedTopOffAmountCents = new Set(
  getAutoTopOffPacks().map((pack) => pack.amountCents),
);

const bodySchema = z.object({
  autoTopOffEnabled: z.boolean(),
  minimumBalanceCredits: z.coerce.number().int().min(0).max(1_000_000),
  monthlySpendLimitCents: z.coerce.number().int().min(0).max(1_000_000),
  topOffAmountCents: z.coerce
    .number()
    .int()
    .refine(
      (value) => allowedTopOffAmountCents.has(value),
      "Select one of the supported auto-top-off pack amounts.",
    ),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug } = await context.params;
    await syncUserFromSession(user);

    const organization = await getOrganizationWorkspaceBySlug({
      orgSlug,
      userExternalId: user.id,
    });
    const body = bodySchema.parse(await request.json());
    const preferences = await upsertBillingPreferences({
      organizationId: organization.id,
      preferences: body,
    });

    return json({
      preferences: {
        autoTopOffEnabled:
          preferences?.autoTopOffEnabled ?? body.autoTopOffEnabled,
        minimumBalanceCredits:
          preferences?.minimumBalanceCredits ?? body.minimumBalanceCredits,
        monthlySpendLimitCents:
          preferences?.monthlySpendLimitCents ?? body.monthlySpendLimitCents,
        topOffAmountCents:
          preferences?.topOffAmountCents ?? body.topOffAmountCents,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(
        {
          code: "billing_preferences_invalid",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid billing preferences.",
        },
        400,
      );
    }

    return json(
      {
        code: "billing_preferences_failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save billing preferences.",
      },
      400,
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}
