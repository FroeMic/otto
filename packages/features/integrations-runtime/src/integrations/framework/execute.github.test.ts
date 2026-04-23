import assert from "node:assert/strict"
import { describe, it } from "vitest"

import { executeRegisteredIntegrationCommand } from "./execute"

describe("GitHub App integration execution", () => {
  it("rejects GitHub commands that are not implemented", async () => {
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
      /github does not support the repository\.list command/,
    )
  })
})
