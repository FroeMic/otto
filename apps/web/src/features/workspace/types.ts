export interface ConnectedAccount {
  avatarUrl: string | null
  displayName: string | null
  externalId: string
  fullName: string | null
  id: string
  provider: string
  username: string | null
}

export interface UserProfile {
  email: string
  firstName: string
  lastName: string
  name: string
}
