import assert from "node:assert/strict"
import { createVerify, generateKeyPairSync } from "node:crypto"
import { describe, it, vi } from "vitest"

import {
  createGitHubAppJwt,
  requestGitHubInstallationAccessToken,
} from "./auth"

describe("GitHub App auth", () => {
  it("creates a GitHub App JWT signed with the configured private key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    })
    const jwt = createGitHubAppJwt({
      appId: "12345",
      now: new Date("2026-04-23T09:00:00.000Z"),
      privateKeyPem: privateKey.export({
        format: "pem",
        type: "pkcs1",
      }) as string,
    })
    const [encodedHeader, encodedPayload, encodedSignature] = jwt.split(".")

    assert.ok(encodedHeader)
    assert.ok(encodedPayload)
    assert.ok(encodedSignature)
    assert.deepEqual(JSON.parse(base64UrlDecode(encodedHeader)), {
      alg: "RS256",
      typ: "JWT",
    })
    assert.deepEqual(JSON.parse(base64UrlDecode(encodedPayload)), {
      exp: 1776935340,
      iat: 1776934800,
      iss: "12345",
    })

    const verifier = createVerify("RSA-SHA256")
    verifier.update(`${encodedHeader}.${encodedPayload}`)
    verifier.end()
    assert.equal(
      verifier.verify(publicKey, Buffer.from(encodedSignature, "base64url")),
      true,
    )
  })

  it("requests a short-lived installation access token from GitHub", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          expires_at: "2026-04-23T10:00:00Z",
          permissions: {
            contents: "write",
          },
          repository_selection: "selected",
          token: "ghs_token",
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 201,
        },
      ),
    )

    const token = await requestGitHubInstallationAccessToken({
      appJwt: "app.jwt",
      fetch: fetchMock,
      installationId: "98765",
    })

    assert.deepEqual(token, {
      expiresAt: "2026-04-23T10:00:00Z",
      permissions: {
        contents: "write",
      },
      repositorySelection: "selected",
      token: "ghs_token",
    })
    assert.equal(
      fetchMock.mock.calls[0]?.[0],
      "https://api.github.com/app/installations/98765/access_tokens",
    )
    assert.deepEqual(fetchMock.mock.calls[0]?.[1], {
      body: undefined,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer app.jwt",
        "User-Agent": "Workspace-GitHub-Integration",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: "POST",
    })
  })
})

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}
