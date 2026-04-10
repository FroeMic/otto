import { Navigate } from "@tanstack/react-router"

export interface PlatformRedirectPageProps {}

export function PlatformRedirectPage(_props: PlatformRedirectPageProps) {
  return <Navigate to="/platform/organizations" />
}
