import assert from "node:assert/strict"
import { describe, it, vi } from "vitest"

import {
  buildGitHubAppInstallUrl,
  completeGitHubAppInstallation,
  createGitHubAppSetupState,
  verifyGitHubAppSetupState,
} from "./github-app"

const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAxpQnfN2z7Xw2AQnKKc3U+o8mjr84xqq7v2sA+0D32aOhIUUq
uUvv6LJGJD6lwjrX1HvOmzYFKBpY5fTJrF8Q4GX6lC8hmigE+alTHr/P1Yg9IjRa
Y/Pe+in56m0ELM8RfH29nJ75y6OwNKBkNLY2+sr9IPxw3Gbf8u5eHz9iw21vhugf
jZ/4OE7Q3TJLgOV0V4C1hWKC6uWDdTAC8q/03PqMJm3ez/5AT8IVc1ehSUXkmKzB
kGP/J+Te4E1Se0uSAvAVKlIZyV+APjjyd8lvtNUtUhjs5I7W6Y8N7mhzgqwm9xkw
kF6KRm32jZeCBrvDY6S4QsxQzU5CvtzK4FnBjwIDAQABAoIBAAZalXziRx16Xn1R
rxgBNP4CbrhkhN8t7Uf4WQwAr8CGEwOYcqYNr/ADkWKvgfxs0KTqaHbNZOnqR1wv
c6/MnV4tMLDUEN6uCv5IatOxJ8y5RXPGSGhBFfR73zYEKyqcBVVOr6viavMCcoqX
TNgNcrsxH8nN8uTWKKu9eySxymepAIqCkyb7NCng6yP4+bvEuvM6VpvU/hKkTyrh
62YEg09ABcJh8WmLEZzQ+hnMWHMxUnXTQTFo3gWKTdK1Gl8pFOS/Qs5JfH8e9aIV
QnMLJzlvK8boi0aWc9fJBmEQsxXMKCbCKSZoE0WTTHIu8yVgFKRRbBx32y2XKXvL
rMpU7EECgYEA5FO0gnkxsYvPmpOxCkQlH8Rty1dLc8c/kCVIwmD4HznTVcNZqfCo
h0PgS+32s6XuPSvj31bpIt9wq6QXuv/GGXP5KmgB5Sh4R9Vyfi0N/rEuaLA5sNh4
N5T9L1FMZ4sc9zAzXAkLKlxO+cc91d+Te0LuMl0dDVt6G2WOtQ28EfECgYEA3l+u
K/Y62ow0rGCCwVycQTLdJ/XwUcl11+JKONVLmShN12sSJC2a/rHVmzY0OBwWnP22
jzDH6h1Wm6InBswdfhSqn8HCcU0Qo1djv2iwvxzyZYntPBTfLIdrv2WKl1e8MM+c
mH/wR44l8XsdlrHuvxLg3XowWrs2kkC11vScjYcCgYBlTsdv6YpRVozEzhN9Fv2W
3yeWvDHl70ytdkQsnBTnGKoVefMBdOKwK6EsE8uqQjOinrhXif0jml/WiSgEouEE
E42Zq2+fXDb1Kc9TVOdZBvBpWB8rzxtDgozrQ4YbqQr9B7Bxiac5LhdTfp8ABTsy
THVNf1rdKhl+2cA+QOGmcQKBgQCyGR3k+ZyGGf7ikD3CfDnGGRdSNII4YfWmHpVR
0qqtHpnwRWGs78SjytYu6S2fVF0jPb1dSZn7lt8d8l90h/rP0fJgC74/fUtVPhIi
7FUG6XKP+Pl3V+j87wrOVjPvv7PUkXVLNcJLXbZI5iZwE9IRw8h90VLXLMcQ66Ar
GPnQJQKBgAK71p6Sz6JiqkwrdeeaW2F3LfxmoqpFOG/oKLk2dbrCV6Fx/vX6MJBg
g7hq2XLkWB/t5/FnyW0J0s+e/ZMkhmXU0nFcZRGWKpc2xLwQvp4jXwHWoVS2rsqR
mgwzEesUle+1y5m0ZyDGKxiPwSu6NXT1anAE5amXReyT0Nz5QHBY
-----END RSA PRIVATE KEY-----`

describe("GitHub App setup", () => {
  it("builds and verifies a signed setup state", () => {
    const state = createGitHubAppSetupState({
      now: new Date("2026-04-23T10:00:00.000Z"),
      orgSlug: "t35",
      secret: "state-secret",
      userExternalId: "user_123",
    })

    assert.deepEqual(
      verifyGitHubAppSetupState({
        encodedState: state,
        now: new Date("2026-04-23T10:02:00.000Z"),
        secret: "state-secret",
      }),
      {
        exp: 1776939300,
        orgSlug: "t35",
        userExternalId: "user_123",
      },
    )
    assert.throws(() =>
      verifyGitHubAppSetupState({
        encodedState: state,
        now: new Date("2026-04-23T10:16:00.000Z"),
        secret: "state-secret",
      }),
    )
  })

  it("builds the GitHub App install URL", () => {
    assert.equal(
      buildGitHubAppInstallUrl({
        appSlug: "workspace-assistant-dev",
        state: "abc.def",
      }),
      "https://github.com/apps/workspace-assistant-dev/installations/new?state=abc.def",
    )
  })

  it("verifies installation and syncs repositories", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          account: {
            id: 42,
            login: "acme",
            type: "Organization",
          },
          app_id: 123,
          app_slug: "workspace-assistant-dev",
          events: ["pull_request", "push"],
          id: 987,
          permissions: {
            contents: "write",
            pull_requests: "write",
          },
          repository_selection: "selected",
          suspended_at: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          expires_at: "2026-04-23T11:00:00Z",
          permissions: {
            contents: "write",
          },
          repository_selection: "selected",
          token: "ghs_installation",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          repositories: [
            {
              archived: false,
              default_branch: "main",
              disabled: false,
              full_name: "acme/web-app",
              id: 555,
              name: "web-app",
              owner: {
                login: "acme",
              },
              private: true,
            },
          ],
        }),
      )
    const upsertInstallation = vi
      .fn()
      .mockResolvedValue("github-installation-row")
    const upsertRepositories = vi.fn().mockResolvedValue(undefined)

    const result = await completeGitHubAppInstallation({
      appId: "123",
      fetch,
      installationId: "987",
      privateKeyPem: privateKey,
      tenantId: "tenant-1",
      tenantIntegrationId: "tenant-integration-1",
      upsertInstallation,
      upsertRepositories,
    })

    assert.deepEqual(result, {
      accountLogin: "acme",
      installationId: "987",
      repositoryCount: 1,
    })
    assert.equal(fetch.mock.calls.length, 3)
    assert.equal(
      fetch.mock.calls[0]?.[0],
      "https://api.github.com/app/installations/987",
    )
    assert.equal(
      fetch.mock.calls[2]?.[0],
      "https://api.github.com/installation/repositories?per_page=100",
    )
    assert.deepEqual(upsertInstallation.mock.calls[0]?.[0], {
      accountId: "42",
      accountLogin: "acme",
      accountType: "Organization",
      appId: "123",
      appSlug: "workspace-assistant-dev",
      events: ["pull_request", "push"],
      installationId: "987",
      permissions: {
        contents: "write",
        pull_requests: "write",
      },
      repositorySelection: "selected",
      suspendedAt: null,
      tenantId: "tenant-1",
      tenantIntegrationId: "tenant-integration-1",
    })
    assert.deepEqual(upsertRepositories.mock.calls[0]?.[0], {
      githubInstallationId: "github-installation-row",
      repositories: [
        {
          archived: false,
          defaultBranch: "main",
          disabled: false,
          fullName: "acme/web-app",
          githubRepositoryId: "555",
          isPrivate: true,
          name: "web-app",
          ownerLogin: "acme",
          selectedByInstallation: true,
        },
      ],
    })
  })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  })
}
