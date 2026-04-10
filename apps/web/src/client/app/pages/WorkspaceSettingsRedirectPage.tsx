import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

export interface WorkspaceSettingsRedirectPageProps {
  orgSlug: string
}

export function WorkspaceSettingsRedirectPage({
  orgSlug,
}: WorkspaceSettingsRedirectPageProps) {
  const navigate = useNavigate({ from: "/$orgSlug/settings/" })

  useEffect(() => {
    void navigate({
      params: { orgSlug },
      replace: true,
      to: "/$orgSlug/settings/workspace",
    })
  }, [navigate, orgSlug])

  return <div className="text-sm text-muted-foreground">Loading settings…</div>
}
