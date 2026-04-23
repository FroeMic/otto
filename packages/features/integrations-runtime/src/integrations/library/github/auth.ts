import { createSign } from "node:crypto"

export type GitHubInstallationAccessToken = {
  expiresAt: string
  permissions: Record<string, string>
  repositorySelection: string
  token: string
}

type GitHubInstallationTokenResponse = {
  expires_at?: unknown
  permissions?: unknown
  repository_selection?: unknown
  token?: unknown
}

export function createGitHubAppJwt(input: {
  appId: string
  now?: Date
  privateKeyPem: string
}) {
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000)
  const header = {
    alg: "RS256",
    typ: "JWT",
  }
  const payload = {
    exp: nowSeconds + 9 * 60,
    iat: nowSeconds,
    iss: input.appId,
  }
  const encodedHeader = encodeBase64Url(JSON.stringify(header))
  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signer = createSign("RSA-SHA256")

  signer.update(signingInput)
  signer.end()

  return `${signingInput}.${signer.sign(input.privateKeyPem).toString("base64url")}`
}

export async function requestGitHubInstallationAccessToken(input: {
  apiBaseUrl?: string
  appJwt: string
  fetch?: typeof fetch
  installationId: string
}): Promise<GitHubInstallationAccessToken> {
  const fetchImplementation = input.fetch ?? globalThis.fetch
  const apiBaseUrl = (input.apiBaseUrl ?? "https://api.github.com").replace(
    /\/+$/,
    "",
  )
  const response = await fetchImplementation(
    `${apiBaseUrl}/app/installations/${encodeURIComponent(input.installationId)}/access_tokens`,
    {
      body: undefined,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.appJwt}`,
        "User-Agent": "Workspace-GitHub-Integration",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: "POST",
    },
  )
  const bodyText = await response.text()
  const body = parseJsonObject(bodyText)

  if (!response.ok) {
    throw new Error(
      `GitHub installation token request failed (${response.status}): ${bodyText}`,
    )
  }

  return parseInstallationTokenResponse(body)
}

function parseInstallationTokenResponse(
  body: GitHubInstallationTokenResponse,
): GitHubInstallationAccessToken {
  if (
    typeof body.token !== "string" ||
    typeof body.expires_at !== "string" ||
    typeof body.repository_selection !== "string" ||
    !isStringRecord(body.permissions)
  ) {
    throw new Error("GitHub installation token response was malformed.")
  }

  return {
    expiresAt: body.expires_at,
    permissions: body.permissions,
    repositorySelection: body.repository_selection,
    token: body.token,
  }
}

function parseJsonObject(value: string): GitHubInstallationTokenResponse {
  try {
    const parsed = JSON.parse(value) as unknown

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as GitHubInstallationTokenResponse
    }
  } catch {
    // Fall through to the consistent malformed-response error below.
  }

  throw new Error("GitHub installation token response was malformed.")
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  )
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}
