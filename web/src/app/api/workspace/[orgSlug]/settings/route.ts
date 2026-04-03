import { withAuth } from "@workos-inc/authkit-nextjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import { syncUserFromSession } from "@/db/control-plane";
import { organizations } from "@/db/schema";
import { getWorkOS } from "@/lib/workos";

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

const bodySchema = z.discriminatedUnion("action", [
  updateNameSchema,
  updateSlugSchema,
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    const { orgSlug } = await context.params;
    await syncUserFromSession(user);

    const db = getDb();
    const body = bodySchema.parse(await request.json());

    // Find the organization by slug
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { code: "not_found", message: "Workspace not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (body.action === "update-name") {
      // Update name in WorkOS and local DB
      const workos = getWorkOS();
      await workos.organizations.updateOrganization({
        organization: org.externalId,
        name: body.name,
      });

      await db
        .update(organizations)
        .set({ name: body.name, updatedAt: new Date() })
        .where(eq(organizations.id, org.id));

      return NextResponse.json(
        { name: body.name },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (body.action === "update-slug") {
      // Check slug uniqueness
      const [existing] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, body.slug))
        .limit(1);

      if (existing && existing.id !== org.id) {
        return NextResponse.json(
          { code: "slug_taken", message: "This URL is already in use" },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }

      await db
        .update(organizations)
        .set({ slug: body.slug, updatedAt: new Date() })
        .where(eq(organizations.id, org.id));

      return NextResponse.json(
        { slug: body.slug },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
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

    const message =
      error instanceof Error ? error.message : "Update failed";

    return NextResponse.json(
      { code: "update_failed", message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
