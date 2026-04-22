import { useLocation, useNavigate } from "@tanstack/react-router"
import { useTransition } from "react"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

import type { IntegrationInstallStateFilter } from "../integrations-filter"

export interface IntegrationsInstallStateSelectProps {
  value: IntegrationInstallStateFilter
}

const INSTALL_STATE_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Installed", value: "installed" },
  { label: "Not installed", value: "not-installed" },
] as const

export function IntegrationsInstallStateSelect({
  value,
}: IntegrationsInstallStateSelectProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [isPending, startTransition] = useTransition()

  return (
    <NativeSelect
      aria-label="Filter integrations by installation state"
      className="w-full sm:w-40 sm:min-w-40 sm:max-w-40 sm:flex-none"
      disabled={isPending}
      onChange={(event) => {
        const nextValue = event.target.value as IntegrationInstallStateFilter
        const params = new URLSearchParams(location.searchStr)

        if (nextValue === "all") {
          params.delete("installState")
        } else {
          params.set("installState", nextValue)
        }

        startTransition(() => {
          void navigate({
            replace: true,
            search: params.size > 0 ? Object.fromEntries(params.entries()) : {},
            to: location.pathname,
          })
        })
      }}
      size="default"
      value={value}
    >
      {INSTALL_STATE_OPTIONS.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
