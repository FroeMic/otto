import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  isReservedWorkspaceSlug,
  normalizeWorkspaceSlug,
  PUBLIC_RESERVED_WORKSPACE_SLUGS,
  RESERVED_WORKSPACE_SLUGS,
  SYSTEM_RESERVED_WORKSPACE_SLUGS,
} from "./index"

describe("workspace slugs", () => {
  it("normalizes slugs consistently", () => {
    assert.equal(normalizeWorkspaceSlug("  Northstar Labs  "), "northstar-labs")
    assert.equal(normalizeWorkspaceSlug("Docs/API"), "docs-api")
  })

  it("reserves public marketing namespaces", () => {
    assert.equal(isReservedWorkspaceSlug("docs"), true)
    assert.equal(isReservedWorkspaceSlug("pricing"), true)
    assert.equal(isReservedWorkspaceSlug("status"), true)
  })

  it("reserves internal system namespaces", () => {
    assert.equal(isReservedWorkspaceSlug("api"), true)
    assert.equal(isReservedWorkspaceSlug("ingest"), true)
    assert.equal(isReservedWorkspaceSlug("oauth"), true)
    assert.equal(isReservedWorkspaceSlug("platform"), true)
  })

  it("does not reserve normal workspace slugs", () => {
    assert.equal(isReservedWorkspaceSlug("northstar-labs"), false)
    assert.equal(isReservedWorkspaceSlug("docs-team"), false)
  })

  it("keeps the reserved slug list unique", () => {
    assert.equal(
      new Set(RESERVED_WORKSPACE_SLUGS).size,
      RESERVED_WORKSPACE_SLUGS.length,
    )
    assert.ok(PUBLIC_RESERVED_WORKSPACE_SLUGS.length > 0)
    assert.ok(SYSTEM_RESERVED_WORKSPACE_SLUGS.length > 0)
  })
})
