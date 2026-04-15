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
      transcribePublicIntakeAudio: async () => "",
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

  it("transcribes uploaded landing audio through the public intake route", async () => {
    const app = createPublicIntakeRouter({
      createPublicIntakeSession: async () => {
        return {
          id: "unused",
        }
      },
      publicBaseUrl: "https://getyourotto.com",
      transcribePublicIntakeAudio: async ({ file }) => {
        assert.equal(file.name, "brief.webm")
        return "help me launch this business"
      },
    })

    const formData = new FormData()
    formData.set(
      "file",
      new File([new Uint8Array([1, 2, 3])], "brief.webm", {
        type: "audio/webm",
      }),
    )

    const response = await app.request(
      "https://api.getyourotto.com/api/public/intake/transcribe",
      {
        body: formData,
        method: "POST",
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      transcript: "help me launch this business",
    })
  })

  it("rejects landing transcription requests without a file", async () => {
    const app = createPublicIntakeRouter({
      createPublicIntakeSession: async () => {
        return {
          id: "unused",
        }
      },
      publicBaseUrl: "https://getyourotto.com",
      transcribePublicIntakeAudio: async () => "",
    })

    const response = await app.request(
      "https://api.getyourotto.com/api/public/intake/transcribe",
      {
        body: new FormData(),
        method: "POST",
      },
    )

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: "Missing file",
    })
  })
})
