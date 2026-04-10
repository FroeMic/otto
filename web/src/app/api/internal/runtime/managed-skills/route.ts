import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createTenantManagedSkillForTenant,
  deleteTenantManagedSkillForTenant,
  updateTenantManagedSkillForTenant,
} from "@/db/control-plane";
import {
  getLatestTenantManagedSkillDetailForTenant,
  listTenantManagedSkillsForTenant,
  ManagedSkillVersionConflictError,
} from "@/db/managed-skills";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";

export const dynamic = "force-dynamic";

const MANAGED_SKILL_ENTRY_FILE_PATH = "SKILL.md";

const createSchema = z
  .object({
    contentText: z.string().optional(),
    description: z.string().trim().min(1).optional(),
    integrationKeys: z.array(z.string().trim().min(1)).optional(),
    skillBody: z.string().optional(),
    skillKey: z.string().trim().min(1),
    skillKeys: z.array(z.string().trim().min(1)).optional(),
    summary: z.string().trim().min(1).max(500).optional(),
  })
  .refine(
    (value) =>
      typeof value.contentText === "string" ||
      typeof value.description === "string" ||
      typeof value.skillBody === "string",
    {
      message:
        "Provide contentText or structured skill fields when creating a managed skill.",
      path: ["contentText"],
    },
  );

const updateSchema = z
  .object({
    contentText: z.string().optional(),
    description: z.string().trim().min(1).optional(),
    enabled: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional(),
    integrationKeys: z.array(z.string().trim().min(1)).optional(),
    skillBody: z.string().optional(),
    skillKey: z.string().trim().min(1),
    skillKeys: z.array(z.string().trim().min(1)).optional(),
    summary: z.string().trim().min(1).max(500).optional(),
  })
  .refine(
    (value) =>
      typeof value.contentText === "string" ||
      typeof value.description === "string" ||
      typeof value.skillBody === "string" ||
      Array.isArray(value.integrationKeys) ||
      Array.isArray(value.skillKeys) ||
      typeof value.enabled === "boolean",
    {
      message:
        "Provide at least one managed skill patch field when updating a managed skill.",
      path: ["contentText"],
    },
  );

const deleteSchema = z.object({
  expectedVersion: z.number().int().positive(),
  skillKey: z.string().trim().min(1),
  summary: z.string().trim().min(1).max(500).optional(),
});

export async function GET(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const url = new URL(request.url);
    const skillKey = url.searchParams.get("skillKey")?.trim();
    const filePath = url.searchParams.get("filePath")?.trim();

    if (filePath) {
      return json(
        {
          error:
            "filePath is no longer supported on the runtime-managed skills surface. Use get_managed_skill for SKILL.md content and normal file tools for local skill directories.",
        },
        400,
      );
    }

    if (!skillKey) {
      const skills = await listTenantManagedSkillsForTenant({
        tenantId,
      });

      return json({
        skills,
      });
    }

    const detail = await getLatestTenantManagedSkillDetailForTenant({
      skillKey,
      tenantId,
    });

    if (!detail) {
      return json(
        {
          error: `Managed skill not found: ${skillKey}`,
        },
        404,
      );
    }

    const entryFile =
      detail.files.find((file) => file.path === MANAGED_SKILL_ENTRY_FILE_PATH) ??
      null;

    return json({
      skill: {
        ...detail,
        contentText:
          entryFile?.storageEncoding === "utf8_text" ? entryFile.contentText : null,
        files: detail.files.map((file) => ({
          contentType: file.contentType,
          editability: file.editability,
          path: file.path,
          storageEncoding: file.storageEncoding,
        })),
      },
    });
  } catch (error) {
    return handleRuntimeRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const body = createSchema.parse(await request.json());

    const result = await createTenantManagedSkillForTenant({
      ...(typeof body.contentText === "string"
        ? {
            contentText: body.contentText,
          }
        : {}),
      createdByExternalId: null,
      createdByType: "runtime",
      ...(typeof body.description === "string"
        ? {
            description: body.description,
          }
        : {}),
      ...(Array.isArray(body.integrationKeys)
        ? {
            integrationKeys: body.integrationKeys,
          }
        : {}),
      ...(typeof body.skillBody === "string"
        ? {
            skillBody: body.skillBody,
          }
        : {}),
      skillKey: body.skillKey,
      ...(Array.isArray(body.skillKeys)
        ? {
            skillKeys: body.skillKeys,
          }
        : {}),
      summary: body.summary ?? `Runtime created managed skill ${body.skillKey}`,
      tenantId,
    });

    return json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(
        {
          error: "Invalid managed skill payload",
          issues: error.issues,
        },
        400,
      );
    }

    return handleRuntimeRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const body = updateSchema.parse(await request.json());

    const result = await updateTenantManagedSkillForTenant({
      createdByExternalId: null,
      createdByType: "runtime",
      expectedVersion: body.expectedVersion,
      patch: {
        ...(typeof body.contentText === "string"
          ? {
              contentText: body.contentText,
            }
          : {}),
        ...(typeof body.description === "string"
          ? {
              description: body.description,
            }
          : {}),
        ...(typeof body.enabled === "boolean"
          ? {
              enabled: body.enabled,
            }
          : {}),
        ...(Array.isArray(body.integrationKeys)
          ? {
              integrationKeys: body.integrationKeys,
            }
          : {}),
        ...(typeof body.skillBody === "string"
          ? {
              skillBody: body.skillBody,
            }
          : {}),
        ...(Array.isArray(body.skillKeys)
          ? {
              skillKeys: body.skillKeys,
            }
          : {}),
      },
      skillKey: body.skillKey,
      summary: body.summary ?? `Runtime updated managed skill ${body.skillKey}`,
      tenantId,
    });

    return json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(
        {
          error: "Invalid managed skill payload",
          issues: error.issues,
        },
        400,
      );
    }

    return handleRuntimeRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const body = deleteSchema.parse(await request.json());

    const result = await deleteTenantManagedSkillForTenant({
      createdByExternalId: null,
      createdByType: "runtime",
      expectedVersion: body.expectedVersion,
      skillKey: body.skillKey,
      summary: body.summary ?? `Runtime deleted managed skill ${body.skillKey}`,
      tenantId,
    });

    return json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(
        {
          error: "Invalid managed skill payload",
          issues: error.issues,
        },
        400,
      );
    }

    return handleRuntimeRouteError(error);
  }
}

function handleRuntimeRouteError(error: unknown) {
  if (error instanceof Error) {
    if (error instanceof ManagedSkillVersionConflictError) {
      return json(
        {
          currentVersion: error.currentVersion,
          error: error.message,
          expectedVersion: error.expectedVersion,
        },
        409,
      );
    }

    if (
      error.message === "Missing runtime bearer token" ||
      error.message === "Invalid runtime bearer token"
    ) {
      return json(
        {
          error: error.message,
        },
        401,
      );
    }

    return json(
      {
        error: error.message,
      },
      400,
    );
  }

  return json(
    {
      error: "Managed skills request failed",
    },
    500,
  );
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}
