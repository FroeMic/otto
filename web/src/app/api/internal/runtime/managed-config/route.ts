import {
  handleManagedConfigGetRequest,
  handleManagedConfigPatchRequest,
} from "@otto/feature-runtime-core";

import {
  getLatestTenantManagedConfig,
  ManagedConfigVersionConflictError,
  updateTenantManagedFileSharedContentForTenant,
} from "@/db/control-plane";
import { normalizeManagedBootstrapFilePath } from "@/lib/openclaw/managed-config";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleManagedConfigGetRequest({
    authenticateTenantRuntimeRequest,
    getLatestTenantManagedConfig,
    normalizeManagedBootstrapFilePath,
    request,
  });
}

export async function PATCH(request: Request) {
  return handleManagedConfigPatchRequest({
    authenticateTenantRuntimeRequest,
    isVersionConflictError: (
      error,
    ): error is ManagedConfigVersionConflictError =>
      error instanceof ManagedConfigVersionConflictError,
    normalizeManagedBootstrapFilePath,
    request,
    updateTenantManagedFileSharedContentForTenant,
  });
}
