import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { getManagedBootstrapFileDefinitions } from "./definition"

describe("managed config definitions", () => {
  it("includes the project workspace contract in AGENTS.md", () => {
    const agentDefinition = getManagedBootstrapFileDefinitions().find(
      (definition) => definition.path === "AGENTS.md",
    )

    assert.ok(agentDefinition)
    assert.match(agentDefinition.systemContent, /## Projects/)
    assert.match(agentDefinition.systemContent, /projects\/<project-key>\//)
    assert.match(agentDefinition.systemContent, /## Business Building Mode/)
    assert.match(agentDefinition.systemContent, /`greenfield`/)
    assert.match(agentDefinition.systemContent, /`brownfield`/)
    assert.match(agentDefinition.systemContent, /## Business Skill Routing/)
  })
})
