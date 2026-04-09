import {
  handleManagedSkillsGetRequest,
  handleManagedSkillsPatchRequest,
} from "@otto/feature-runtime-core";

import { updateTenantManagedSkillTextFileForTenant } from "@/db/control-plane";
import {
  getLatestTenantManagedSkillDetailForTenant,
  listTenantManagedSkillsForTenant,
  ManagedSkillVersionConflictError,
} from "@/db/managed-skills";
import { MANAGED_SKILL_ENTRY_FILE_PATH } from "@/lib/managed-skills/package";
import { authenticateTenantRuntimeRequest } from "@/lib/runtime-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleManagedSkillsGetRequest({
    authenticateTenantRuntimeRequest,
    getLatestTenantManagedSkillDetailForTenant,
    listTenantManagedSkillsForTenant,
    managedSkillEntryFilePath: MANAGED_SKILL_ENTRY_FILE_PATH,
    request,
  });
}

export async function PATCH(request: Request) {
  return handleManagedSkillsPatchRequest({
    authenticateTenantRuntimeRequest,
    isVersionConflictError: (
      error,
    ): error is ManagedSkillVersionConflictError =>
      error instanceof ManagedSkillVersionConflictError,
    managedSkillEntryFilePath: MANAGED_SKILL_ENTRY_FILE_PATH,
    request,
    updateTenantManagedSkillTextFileForTenant,
  });
}
