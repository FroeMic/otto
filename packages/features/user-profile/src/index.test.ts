import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  connectedAccountsResponseSchema,
  updateUserProfileSchema,
  userProfileSchema,
} from "./index"

describe("user profile feature contracts", () => {
  it("trims profile updates and requires a first name", () => {
    assert.deepEqual(
      updateUserProfileSchema.parse({
        firstName: "  Michael  ",
        lastName: "  Frohlich  ",
      }),
      {
        firstName: "Michael",
        lastName: "Frohlich",
      },
    )

    assert.equal(
      updateUserProfileSchema.safeParse({
        firstName: "  ",
        lastName: "Frohlich",
      }).success,
      false,
    )
  })

  it("validates profile and connected account response shapes", () => {
    assert.equal(
      userProfileSchema.safeParse({
        email: "not-an-email",
        firstName: "Michael",
        lastName: "Frohlich",
        name: "Michael Frohlich",
      }).success,
      false,
    )

    assert.deepEqual(
      connectedAccountsResponseSchema.parse({
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
      }),
      {
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
      },
    )
  })
})
