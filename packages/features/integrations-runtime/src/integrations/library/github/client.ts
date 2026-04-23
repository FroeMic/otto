import type { GitHubInstallationAccessToken } from "./auth"

export class GitHubApiError extends Error {
  readonly body: unknown
  readonly bodyText: string
  readonly status: number
  readonly statusText: string

  constructor(input: {
    body: unknown
    bodyText: string
    message: string
    status: number
    statusText: string
  }) {
    super(input.message)
    this.name = "GitHubApiError"
    this.body = input.body
    this.bodyText = input.bodyText
    this.status = input.status
    this.statusText = input.statusText
  }
}

export type GitHubCommandAuth = {
  getAccessToken: () => Promise<GitHubInstallationAccessToken>
}

export async function githubJsonRequest(input: {
  apiBaseUrl?: string
  auth: GitHubCommandAuth
  body?: unknown
  fetch?: typeof fetch
  method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT"
  path: string
}) {
  const fetchImplementation = input.fetch ?? globalThis.fetch
  const apiBaseUrl = (input.apiBaseUrl ?? "https://api.github.com").replace(
    /\/+$/,
    "",
  )
  const access = await input.auth.getAccessToken()
  const response = await fetchImplementation(`${apiBaseUrl}${input.path}`, {
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${access.token}`,
      ...(input.body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
          }),
      "User-Agent": "Workspace-GitHub-Integration",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    method: input.method,
  })
  const bodyText = await response.text()
  const body = parseJsonBody(bodyText)

  if (!response.ok) {
    throw new GitHubApiError({
      body,
      bodyText,
      message: getGitHubErrorMessage({
        body,
        status: response.status,
        statusText: response.statusText,
      }),
      status: response.status,
      statusText: response.statusText,
    })
  }

  return body
}

export function encodeGitHubPathSegment(value: string) {
  return encodeURIComponent(value)
}

export function encodeGitHubRefPath(value: string) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

function parseJsonBody(value: string) {
  if (!value.trim()) {
    return null
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function getGitHubErrorMessage(input: {
  body: unknown
  status: number
  statusText: string
}) {
  if (
    input.body &&
    typeof input.body === "object" &&
    "message" in input.body &&
    typeof input.body.message === "string" &&
    input.body.message.trim()
  ) {
    return input.body.message
  }

  return `GitHub request failed (${input.status} ${input.statusText})`.trim()
}
