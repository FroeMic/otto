import { describe, expect, it } from "vitest"

import { createApiFetchHandler } from "./server"

describe("API Bun server adapter", () => {
  it("passes the Bun server through Hono env for websocket upgrades", async () => {
    const calls: unknown[][] = []
    const response = new Response("ok")
    const app = {
      fetch: (...args: unknown[]) => {
        calls.push(args)
        return response
      },
    }
    const server = {
      timeout() {},
    }
    const request = new Request("https://getyourotto.com/healthz")
    const fetch = createApiFetchHandler({
      app,
      env: {},
    })

    await expect(Promise.resolve(fetch(request, server))).resolves.toBe(
      response,
    )

    expect(calls).toEqual([[request, { server }]])
  })
})
