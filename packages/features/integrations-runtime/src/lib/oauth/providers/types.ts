export type OAuthActorType = "app" | "user"

export type OAuthConnectionIdentity = {
  externalAccountId: string | null
  externalAccountLabel: string | null
  providerMetadata?: Record<string, unknown>
}

export type OAuthTokenExchangeResult = {
  accessToken: string
  actorType: OAuthActorType | null
  expiresAt: Date | null
  grantedScopes: string[]
  identity: OAuthConnectionIdentity | null
  idToken: string | null
  raw: Record<string, unknown>
  refreshToken: string | null
  refreshTokenExpiresAt: Date | null
  tokenType: string | null
}

export type OAuthProviderErrorKind = "reauthorize" | "transient"

export type OAuthProviderRequestError = Error & {
  code?: string
  kind?: OAuthProviderErrorKind
  status?: number
}

export type OAuthProviderDefinition = {
  buildAuthorizationUrl(input: {
    codeChallenge: string | null
    state: string
  }): string
  classifyError(error: unknown): OAuthProviderErrorKind
  exchangeCode(input: {
    code: string
    codeVerifier: string | null
  }): Promise<OAuthTokenExchangeResult>
  getAuthorizeParams(): Record<string, string>
  getRequestedScopes(): string[]
  key: string
  label: string
  refreshAccessToken(input: {
    refreshToken: string
  }): Promise<OAuthTokenExchangeResult>
  usesPkce: boolean
}
