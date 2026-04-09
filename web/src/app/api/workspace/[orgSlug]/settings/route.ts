import { withAuth } from "@workos-inc/authkit-nextjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  getOrganizationWorkspaceBySlug,
  syncUserFromSession,
  updateWorkspaceDateTimePreferences,
} from "@/db/control-plane";
import { organizations } from "@/db/schema";
import {
  isSupportedLocale,
  isSupportedTimeZone,
  normalizeTimeFormatPreference,
} from "@/lib/date-time";
import { getWorkOS } from "@/lib/workos";
import { isReservedWorkspaceSlug } from "@/lib/workspace-slugs";

export const dynamic = "force-dynamic";

const updateNameSchema = z.object({
  action: z.literal("update-name"),
  name: z.string().trim().min(1, "Name is required"),
});

const updateSlugSchema = z.object({
  action: z.literal("update-slug"),
  slug: z
    .string()
    .trim()
    .min(1, "URL is required")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "URL must be lowercase letters, numbers, and hyphens",
    ),
});

const updateTimezoneSchema = z.object({
  action: z.literal("update-timezone"),
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required")
    .refine(
      (value) => isSupportedTimeZone(value),
      "Timezone must be a valid IANA timezone",
    ),
});

const updateLocaleSchema = z.object({
  action: z.literal("update-locale"),
  locale: z
    .string()
    .trim()
    .min(1, "Locale is required")
    .refine(
      (value) => isSupportedLocale(value),
      "Locale must be a valid BCP 47 locale",
    ),
});

const updateTimeFormatSchema = z.object({
  action: z.literal("update-time-format"),
  timeFormatPreference: z
    .string()
    .trim()
    .refine(
      (value) => normalizeTimeFormatPreference(value) === value,
      "Time format must be auto, 12, or 24",
    ),
});

const bodySchema = z.discriminatedUnion("action", [
  updateNameSchema,
  updateSlugSchema,
  updateLocaleSchema,
  updateTimeFormatSchema,
  updateTimezoneSchema,
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ orgSlug: string }> },
) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const { orgSlug } = await context.params;

  try {
    await syncUserFromSession(user);

    const db = getDb();
    const body = bodySchema.parse(await request.json());
    const org = await getOrganizationWorkspaceBySlug({
      orgSlug,
      userExternalId: user.id,
    });

    if (body.action === "update-name") {
      const workos = getWorkOS();
      await workos.organizations.updateOrganization({
        organization: org.externalId,
        name: body.name,
      });

      await db
        .update(organizations)
        .set({ name: body.name, updatedAt: new Date() })
        .where(eq(organizations.id, org.id));

      return json({ name: body.name });
    }

    if (body.action === "update-slug") {
      if (isReservedWorkspaceSlug(body.slug)) {
        return json(
          { code: "slug_reserved", message: "This URL is reserved" },
          409,
        );
      }

      const [existing] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, body.slug))
        .limit(1);

      if (existing && existing.id !== org.id) {
        return json(
          { code: "slug_taken", message: "This URL is already in use" },
          409,
        );
      }

      await db
        .update(organizations)
        .set({ slug: body.slug, updatedAt: new Date() })
        .where(eq(organizations.id, org.id));

      return json({ slug: body.slug });
    }

    const result = await updateWorkspaceDateTimePreferences(
      body.action === "update-timezone"
        ? {
            organizationId: org.id,
            timezone: body.timezone,
          }
        : body.action === "update-locale"
          ? {
              locale: body.locale,
              organizationId: org.id,
            }
          : {
              organizationId: org.id,
              timeFormatPreference: body.timeFormatPreference,
            },
    );

    return json({
      applyQueued: result.applyQueued,
      locale: result.locale,
      timeFormatPreference: result.timeFormatPreference,
      timezone: result.timezone,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "schema_invalid",
          fieldErrors: z.flattenError(error).fieldErrors,
          message: "Invalid payload",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const message = error instanceof Error ? error.message : "Update failed";

    return NextResponse.json(
      { code: "update_failed", message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}
