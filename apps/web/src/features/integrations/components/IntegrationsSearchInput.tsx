import { useLocation, useNavigate } from "@tanstack/react-router"
import { useTransition } from "react"

import { ToolbarSearchInput } from "@/components/toolbar-search-input"

export interface IntegrationsSearchInputProps {
  initialValue: string
}

export function IntegrationsSearchInput({
  initialValue,
}: IntegrationsSearchInputProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [isPending, startTransition] = useTransition()

  return (
    <ToolbarSearchInput
      aria-label="Search integrations"
      defaultValue={initialValue}
      disabled={isPending}
      placeholder="Search integrations..."
      onChange={(event) => {
        const nextValue = event.target.value.trim()
        const params = new URLSearchParams(location.searchStr)

        if (nextValue) {
          params.set("q", nextValue)
        } else {
          params.delete("q")
        }

        startTransition(() => {
          void navigate({
            replace: true,
            search: params.size > 0 ? Object.fromEntries(params.entries()) : {},
            to: location.pathname,
          })
        })
      }}
    />
  )
}
