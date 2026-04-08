import { NextResponse } from "next/server";
import { z } from "zod";

import { updateTenantManagedSkillTextFileForTenant } from "@/db/control-plane";
import {
  getLatestTenantManagedSkillDetailForTenant,
  listTenantManagedSkillsForTenant,
  ManagedSkillVersionConflictError,
} from "@/db/managed-skills";
import { MANAGED_SKILL_ENTRY_FILE_PATH } from "@/lib/managed-skills/package";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  contentText: z.string(),
  expectedVersion: z.number().int().positive().optional(),
  filePath: z.string().trim().min(1),
  skillKey: z.string().trim().min(1),
  summary: z.string().trim().min(1).max(500).optional(),
});

export async function GET(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const url = new URL(request.url);
    const skillKey = url.searchParams.get("skillKey")?.trim();
    const filePath = url.searchParams.get("filePath")?.trim();

    if (filePath && !skillKey) {
      return json(
        {
          error: "filePath requires skillKey.",
        },
        400,
      );
    }

    if (filePath && filePath !== MANAGED_SKILL_ENTRY_FILE_PATH) {
      return json(
        {
          error:
            "Only SKILL.md can be read through the runtime-managed skills surface.",
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

    if (!filePath) {
      return json({
        skill: {
          ...detail,
          files: detail.files.map((file) => ({
            contentType: file.contentType,
            editability: file.editability,
            path: file.path,
            storageEncoding: file.storageEncoding,
          })),
        },
      });
    }

    const file = detail.files.find((entry) => entry.path === filePath);

    if (!file) {
      return json(
        {
          error: `Managed skill file not found: ${skillKey}/${filePath}`,
        },
        404,
      );
    }

    if (file.editability === "local_state") {
      return json(
        {
          error:
            "state/ files are not exposed through the runtime-managed skills surface in this slice.",
        },
        400,
      );
    }

    if (file.storageEncoding !== "utf8_text" || file.contentText === null) {
      return json(
        {
          error:
            "Only managed UTF-8 text files can be read through the runtime-managed skills surface in this slice.",
        },
        400,
      );
    }

    return json({
      file: {
        contentText: file.contentText,
        contentType: file.contentType,
        editability: file.editability,
        path: file.path,
        storageEncoding: file.storageEncoding,
      },
      version: detail.version,
    });
  } catch (error) {
    return handleRuntimeRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const body = patchSchema.parse(await request.json());

    if (body.filePath !== MANAGED_SKILL_ENTRY_FILE_PATH) {
      return json(
        {
          error:
            "Only SKILL.md can be patched through the runtime-managed skills surface.",
        },
        400,
      );
    }

    const result = await updateTenantManagedSkillTextFileForTenant({
      contentText: body.contentText,
      createdByExternalId: null,
      createdByType: "runtime",
      expectedVersion: body.expectedVersion,
      relativePath: body.filePath,
      skillKey: body.skillKey,
      summary:
        body.summary ??
        `Runtime updated managed skill file ${body.skillKey}/${body.filePath}`,
      tenantId,
    });

    return json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(
        {
          error: "Invalid managed skills payload",
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
