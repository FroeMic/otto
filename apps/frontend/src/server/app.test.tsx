import { describe, expect, it } from "vitest"

import { createApp } from "./app"

describe("frontend app", () => {
  const app = createApp()

  it("serves the health check", async () => {
    const response = await app.request("http://localhost/healthz")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "frontend",
    })
  })

  it("renders the landing page", async () => {
    const response = await app.request("http://localhost/")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("Public site placeholder")
    expect(text).toContain("/app/workspace.css")
  })

  it("renders the pricing page", async () => {
    const response = await app.request("http://localhost/pricing")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("Keep the first pricing story simple.")
  })

  it("redirects login to the legacy workspace app", async () => {
    const response = await app.request("http://localhost/login", {
      redirect: "manual",
    })

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe(
      "https://app.getyourotto.com/login",
    )
  })

  it("serves a workspace shell fallback", async () => {
    const response = await app.request("http://localhost/app")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('id="root"')
    expect(text).toContain("/app/workspace.js")
  })
})
