import assert from "node:assert/strict"

import { describe, it } from "vitest"

import { createPublicIntakeRouter } from "./routes"

describe("public intake routes", () => {
  it("captures a landing prompt and redirects to login with the intake id", async () => {
    const app = createPublicIntakeRouter({
      createPublicIntakeSession: async ({ prompt }) => {
        assert.equal(prompt, "Help me run onboarding and support.")

        return {
          id: "3df8ce2b-7c6d-47ca-9fc1-8b57f0db0833",
        }
      },
      publicBaseUrl: "https://getyourotto.com",
    })

    const response = await app.request("https://api.getyourotto.com/api/public/intake", {
      body: new URLSearchParams({
        prompt: "Help me run onboarding and support.",
        returnTo: "/",
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      redirect: "manual",
    })

    assert.equal(response.status, 302)
    assert.equal(
      response.headers.get("location"),
      "https://getyourotto.com/login?returnTo=%2F%3Fintake%3D3df8ce2b-7c6d-47ca-9fc1-8b57f0db0833&prompt=Help%20me%20run%20onboarding%20and%20support.",
    )
  })
})
