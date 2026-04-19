import { describe, expect, it } from "vitest"

import { getManagedBootstrapFileDefinition } from "./managed-config"

describe("managed config definitions", () => {
  it("includes the project workspace contract in AGENTS.md", () => {
    const agentDefinition = getManagedBootstrapFileDefinition("AGENTS.md")

    expect(agentDefinition).not.toBeNull()
    expect(agentDefinition?.systemContent).toContain("## Projects")
    expect(agentDefinition?.systemContent).toContain("projects/<project-key>/")
    expect(agentDefinition?.systemContent).toContain(
      "projects/<project-key>/<project-key>.md",
    )
    expect(agentDefinition?.systemContent).toContain(
      "canonical project entry point",
    )
    expect(agentDefinition?.systemContent).toContain(
      "## Business Building Mode",
    )
    expect(agentDefinition?.systemContent).toContain("`greenfield`")
    expect(agentDefinition?.systemContent).toContain("`brownfield`")
    expect(agentDefinition?.systemContent).toContain(
      "## Business Skill Routing",
    )
  })
})
