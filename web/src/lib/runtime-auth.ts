import { authenticateTenantRuntimeRequest as authenticateTenantRuntimeRequestWithPackage } from "@otto/auth";

import { getTenantByTenantToken } from "@/db/control-plane";

export async function authenticateTenantRuntimeRequest(request: Request) {
  return authenticateTenantRuntimeRequestWithPackage({
    getTenantByTenantToken,
    log: (message) => {
      console.log(message);
    },
    request,
    resolveTenantId: (tenant) => tenant.tenantId,
  });
}
