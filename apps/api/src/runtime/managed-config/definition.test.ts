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

  it("includes conversational pacing guidance in AGENTS.md", () => {
    const agentDefinition = getManagedBootstrapFileDefinitions().find(
      (definition) => definition.path === "AGENTS.md",
    )

    assert.ok(agentDefinition)
    assert.match(agentDefinition.systemContent, /## Conversational Pacing/)
    assert.match(agentDefinition.systemContent, /Ask at most one focused question/)
    assert.match(agentDefinition.systemContent, /recommend one next move/)
    assert.match(agentDefinition.systemContent, /Do not answer early discovery with a long strategy memo/)
  })

  it("captures Michael's durable communication preference in MEMORY.md", () => {
    const memoryDefinition = getManagedBootstrapFileDefinitions().find(
      (definition) => definition.path === "MEMORY.md",
    )

    assert.ok(memoryDefinition)
    assert.match(memoryDefinition.systemContent, /Michael prefers Otto to lead/)
    assert.match(memoryDefinition.systemContent, /shorter replies/)
    assert.match(memoryDefinition.systemContent, /fewer bundled questions/)
  })
})
