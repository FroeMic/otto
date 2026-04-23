import assert from "node:assert/strict"
import { describe, it } from "vitest"

import { executeRegisteredIntegrationCommand } from "./execute"

describe("GitHub App integration execution", () => {
  it("requires a connected tenant integration before running GitHub commands", async () => {
    await assert.rejects(
      () =>
        executeRegisteredIntegrationCommand({
          arguments: {
            limit: 10,
            owner: "acme",
            repo: "web-app",
          },
          commandKey: "repository.list",
          integrationKey: "github",
          tenantIntegrationId: null,
        }),
      /GitHub is not connected in this workspace/,
    )
  })
})
