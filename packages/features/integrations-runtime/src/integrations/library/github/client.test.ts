import assert from "node:assert/strict"
import { describe, it, vi } from "vitest"

import { GitHubApiError, githubJsonRequest } from "./client"

describe("GitHub REST client", () => {
  it("sends installation-token requests without exposing tokens in results", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
        status: 200,
      })
    })

    const result = await githubJsonRequest({
      auth: {
        getAccessToken: async () => ({
          expiresAt: "2026-04-23T12:00:00.000Z",
          permissions: {},
          repositorySelection: "selected",
          token: "secret-token",
        }),
      },
      fetch: fetchMock,
      method: "GET",
      path: "/repos/acme/web-app",
    })
    const fetchCalls = fetchMock.mock.calls as unknown as [
      string,
      { headers: Record<string, string> },
    ][]

    assert.deepEqual(result, { ok: true })
    assert.equal(
      fetchCalls[0]?.[0],
      "https://api.github.com/repos/acme/web-app",
    )
    assert.equal(
      fetchCalls[0]?.[1]?.headers.Authorization,
      "Bearer secret-token",
    )
  })

  it("throws a structured provider error with the response body", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ message: "merge conflict" }), {
        headers: { "content-type": "application/json" },
        status: 405,
        statusText: "Method Not Allowed",
      })
    })

    await assert.rejects(
      githubJsonRequest({
        auth: {
          getAccessToken: async () => ({
            expiresAt: "2026-04-23T12:00:00.000Z",
            permissions: {},
            repositorySelection: "selected",
            token: "secret-token",
          }),
        },
        fetch: fetchMock,
        method: "PUT",
        path: "/repos/acme/web-app/pulls/7/merge",
      }),
      (error) => {
        assert.ok(error instanceof GitHubApiError)
        assert.equal(error.status, 405)
        assert.equal(error.bodyText, '{"message":"merge conflict"}')
        return true
      },
    )
  })
})
