import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { createUserRouter } from "./routes"

describe("user routes", () => {
  it("returns the authenticated user's workspace menu", async () => {
    const app = createUserRouter({
      authenticateWorkspaceUser: async () => ({
        email: "michael@getyourotto.com",
        firstName: "Michael",
        id: "user_123",
        lastName: "Frohlich",
      }),
      getConnectedAccounts: async () => [],
      getDashboardOrganizations: async () => [
        {
          id: "org_1",
          isReady: true,
          locale: "en-US",
          name: "Interaction42",
          slug: "interaction42",
          timeFormatPreference: "auto",
          timezone: "Europe/Vienna",
        },
        {
          id: "org_2",
          isReady: false,
          locale: "en-US",
          name: "Draft Workspace",
          slug: "draft-workspace",
          timeFormatPreference: "auto",
          timezone: "Europe/Vienna",
        },
      ],
      getUserProfile: async () => ({
        email: "michael@getyourotto.com",
        firstName: "Michael",
        lastName: "Frohlich",
      }),
      updateUserProfile: async ({ firstName, lastName }) => ({
        email: "michael@getyourotto.com",
        firstName,
        lastName,
      }),
    })

    const response = await app.request("http://api.local/api/user/workspaces")

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      user: {
        email: "michael@getyourotto.com",
        id: "user_123",
        name: "Michael Frohlich",
      },
      workspaces: [
        {
          id: "org_1",
          isReady: true,
          name: "Interaction42",
          slug: "interaction42",
        },
        {
          id: "org_2",
          isReady: false,
          name: "Draft Workspace",
          slug: "draft-workspace",
        },
      ],
    })
  })
})
