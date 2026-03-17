import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getLatestTenantManagedConfig,
  ManagedConfigVersionConflictError,
  updateTenantManagedFileSharedContentForTenant,
} from "@/db/control-plane";
import { isManagedBootstrapFilePath } from "@/lib/openclaw/managed-config";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
  filePath: z.string(),
  sharedContent: z.string(),
  summary: z.string().trim().min(1).max(500).optional(),
});

export async function GET(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const managedConfig = await getLatestTenantManagedConfig(tenantId);
    const url = new URL(request.url);
    const filePath = url.searchParams.get("filePath");

    if (filePath) {
      if (!isManagedBootstrapFilePath(filePath)) {
        return json(
          {
            error: `Unsupported managed config file: ${filePath}`,
          },
          400,
        );
      }

      const file = managedConfig.files.find((entry) => entry.path === filePath);

      if (!file) {
        return json(
          {
            error: `Managed config file not found: ${filePath}`,
          },
          404,
        );
      }

      return json({
        file,
        version: managedConfig.version,
      });
    }

    return json({
      files: managedConfig.files,
      version: managedConfig.version,
    });
  } catch (error) {
    return handleRuntimeRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { tenantId } = await authenticateTenantRuntimeRequest(request);
    const body = patchSchema.parse(await request.json());

    if (!isManagedBootstrapFilePath(body.filePath)) {
      return json(
        {
          error: `Unsupported managed config file: ${body.filePath}`,
        },
        400,
      );
    }

    const result = await updateTenantManagedFileSharedContentForTenant({
      createdByExternalId: null,
      createdByType: "runtime",
      expectedVersion: body.expectedVersion,
      filePath: body.filePath,
      sharedContent: body.sharedContent,
      summary:
        body.summary ??
        `Runtime updated shared managed config block for ${body.filePath}`,
      tenantId,
    });

    return json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(
        {
          error: "Invalid managed config payload",
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
    if (error instanceof ManagedConfigVersionConflictError) {
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
      error: "Managed config request failed",
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
