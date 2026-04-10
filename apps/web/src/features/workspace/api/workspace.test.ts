import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  parseConnectedAccountsResponse,
  parseUserProfile,
} from "./workspace"

describe("workspace api helpers", () => {
  it("parses a user profile response with the shared contract", () => {
    const profile = parseUserProfile({
      email: "michael@getyourotto.com",
      firstName: "Michael",
      lastName: "Frohlich",
      name: "Michael Frohlich",
    })

    assert.equal(profile.name, "Michael Frohlich")
  })

  it("rejects malformed user profile responses", () => {
    assert.throws(() => {
      parseUserProfile({
        email: "michael@getyourotto.com",
      })
    })
  })

  it("parses connected accounts with the shared contract", () => {
    const connectedAccounts = parseConnectedAccountsResponse({
      connectedAccounts: [
        {
          avatarUrl: null,
          displayName: "michael",
          externalId: "U123",
          fullName: "Michael Frohlich",
          id: "identity_1",
          provider: "slack",
          username: "michael",
        },
      ],
    })

    assert.equal(connectedAccounts.length, 1)
    assert.equal(connectedAccounts[0]?.provider, "slack")
  })

  it("rejects malformed connected accounts responses", () => {
    assert.throws(() => {
      parseConnectedAccountsResponse({
        connectedAccounts: [
          {
            provider: "slack",
          },
        ],
      })
    })
  })
})
