import { describe, expect, it } from "vitest"

import {
  getManagedBootstrapFileDefinition,
  getManagedBootstrapFileDefinitions,
} from "./managed-config"

describe("managed config definitions", () => {
  it("uses the shared seven-file managed config definition set", () => {
    expect(
      getManagedBootstrapFileDefinitions().map((definition) => definition.path),
    ).toEqual([
      "AGENTS.md",
      "HEARTBEAT.md",
      "IDENTITY.md",
      "MEMORY.md",
      "SOUL.md",
      "USER.md",
      "TOOLS.md",
    ])
  })

  it("includes the project workspace contract in AGENTS.md", () => {
    const agentDefinition = getManagedBootstrapFileDefinition("AGENTS.md")

    expect(agentDefinition).not.toBeNull()
    expect(agentDefinition?.systemContent).toContain("## Projects")
    expect(agentDefinition?.systemContent).toContain("projects/<project-key>/")
    expect(agentDefinition?.systemContent).toContain(
      "projects/<project-key>/<project-key>.md",
    )
    expect(agentDefinition?.systemContent).toContain("Business Profile")
    expect(agentDefinition?.systemContent).toContain("context/roadmap.md")
    expect(agentDefinition?.systemContent).toContain("context/")
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
