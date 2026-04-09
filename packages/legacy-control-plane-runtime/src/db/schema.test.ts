import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getTableName } from "drizzle-orm";

import { integrationIngressDeliveries } from "./schema";

describe("integrationIngressDeliveries schema", () => {
  it("uses a provider-agnostic ingress delivery table shape", () => {
    assert.equal(
      getTableName(integrationIngressDeliveries),
      "integration_ingress_deliveries",
    );
    assert.deepEqual(
      Object.keys(integrationIngressDeliveries).filter(
        (key) => key !== "enableRLS",
      ),
      [
        "id",
        "tenantIntegrationId",
        "providerKey",
        "endpointKey",
        "requestPath",
        "externalWorkspaceId",
        "externalAccountId",
        "status",
        "attempt",
        "responseStatus",
        "error",
        "providerMetadata",
        "createdAt",
        "finishedAt",
      ],
    );
  });
});
