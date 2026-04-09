import { afterEach, describe, expect, it, vi } from "vitest"

import { createApp } from "./app"

describe("frontend app", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const app = createApp({
    API_ORIGIN: "http://api.internal",
    FRONTEND_PORT: 4100,
    NODE_ENV: "test",
    WORKSPACE_APP_ORIGIN: "https://app.getyourotto.com",
  })

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

  it("renders a same-origin login page", async () => {
    const response = await app.request("http://localhost/login")
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain("Sign in to your workspace")
    expect(text).toContain("/auth/sign-in?returnTo=%2Fapp")
  })

  it("proxies auth requests to the API service", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        headers: {
          location: "https://example.workos.com/authorize",
        },
        status: 302,
      }),
    )

    const response = await app.request(
      "http://localhost/auth/sign-in?returnTo=%2Fapp",
      {
        redirect: "manual",
      },
    )

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [firstCall] = fetchSpy.mock.calls
    const request = firstCall?.[0]

    expect(request).toBeInstanceOf(Request)
    expect((request as Request).url).toBe(
      "http://api.internal/auth/sign-in?returnTo=%2Fapp",
    )
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe(
      "https://example.workos.com/authorize",
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
