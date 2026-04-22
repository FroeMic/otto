import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  buildManagedBootstrapFileContent,
  buildManagedBootstrapSystemContent,
  getManagedBootstrapFileDefinitions,
  normalizeManagedBootstrapFilePath,
} from "./definition"

describe("managed config definitions", () => {
  it("loads all file-backed managed config templates", () => {
    const definitions = getManagedBootstrapFileDefinitions()

    assert.deepEqual(
      definitions.map((definition) => definition.path),
      [
        "AGENTS.md",
        "HEARTBEAT.md",
        "IDENTITY.md",
        "MEMORY.md",
        "SOUL.md",
        "USER.md",
        "TOOLS.md",
      ],
    )

    for (const definition of definitions) {
      assert.ok(definition.systemContent.trim(), definition.path)
      assert.ok(definition.defaultSharedContent.trim(), definition.path)
      assert.doesNotMatch(definition.defaultSharedContent, /OpenClaw template/)
    }
  })

  it("renders tenant files with locked system and workspace sections", () => {
    const identityDefinition = getManagedBootstrapFileDefinitions().find(
      (definition) => definition.path === "IDENTITY.md",
    )

    assert.ok(identityDefinition)

    assert.equal(
      buildManagedBootstrapFileContent({
        path: identityDefinition.path,
        sharedContent: identityDefinition.defaultSharedContent,
        systemContent: identityDefinition.systemContent,
      }),
      [
        "# IDENTITY.md",
        "",
        "<!-- BEGIN SYSTEM -->",
        identityDefinition.systemContent,
        "<!-- END SYSTEM -->",
        "",
        "<!-- BEGIN SHARED -->",
        identityDefinition.defaultSharedContent,
        "<!-- END SHARED -->",
        "",
      ].join("\n"),
    )
  })

  it("appends workspace app context only to TOOLS.md", () => {
    const withContext = {
      ottoBaseUrl: "https://app.example.com/",
      workspaceSlug: "/acme/",
    }

    assert.match(
      buildManagedBootstrapSystemContent({
        path: "TOOLS.md",
        runtimeContext: withContext,
        systemContent: "TOOLS.md - Local Notes",
      }),
      /Workspace home: https:\/\/app\.example\.com\/acme/,
    )
    assert.equal(
      buildManagedBootstrapSystemContent({
        path: "IDENTITY.md",
        runtimeContext: withContext,
        systemContent: "IDENTITY.md - Who Am I?",
      }),
      "IDENTITY.md - Who Am I?",
    )
  })

  it("normalizes legacy managed config file aliases", () => {
    assert.equal(normalizeManagedBootstrapFilePath("USERS.md"), "USER.md")
    assert.equal(normalizeManagedBootstrapFilePath("USER.md"), "USER.md")
    assert.equal(normalizeManagedBootstrapFilePath("missing.md"), null)
  })

  it("keeps the soul template concise, opinionated, and non-corporate", () => {
    const soulDefinition = getManagedBootstrapFileDefinitions().find(
      (definition) => definition.path === "SOUL.md",
    )

    assert.ok(soulDefinition)
    assert.match(soulDefinition.systemContent, /Have strong opinions/)
    assert.match(soulDefinition.systemContent, /Brevity is mandatory/)
    assert.match(
      soulDefinition.systemContent,
      /Never open with "Great question," "I'd be happy to help," or "Absolutely\."/,
    )
    assert.match(soulDefinition.systemContent, /Call things out/)
    assert.match(soulDefinition.systemContent, /Humor is allowed/)
  })

  it("tells agents to use managed tools for personalization files", () => {
    const definitions = getManagedBootstrapFileDefinitions()
    const agentsDefinition = definitions.find(
      (definition) => definition.path === "AGENTS.md",
    )
    const toolsDefinition = definitions.find(
      (definition) => definition.path === "TOOLS.md",
    )

    assert.ok(agentsDefinition)
    assert.ok(toolsDefinition)
    assert.match(agentsDefinition.systemContent, /read_managed_file/)
    assert.match(agentsDefinition.systemContent, /patch_managed_file/)
    assert.match(agentsDefinition.systemContent, /Do not edit the root copies/)
    assert.match(
      toolsDefinition.systemContent,
      /managed versions are canonical/,
    )
    assert.match(toolsDefinition.systemContent, /Never edit the root copies/)
  })
})
