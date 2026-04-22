import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { openBillingPortal, startBillingCheckout } from "../api/billing"

export interface WorkspaceManageBillingButtonProps {
  canOpenBillingPortal: boolean
  className?: string
  label?: string
  orgSlug: string
}

export function WorkspaceManageBillingButton({
  canOpenBillingPortal,
  className,
  label = "Manage billing",
  orgSlug,
}: WorkspaceManageBillingButtonProps) {
  const [pending, setPending] = useState(false)

  return (
    <Button
      className={className}
      disabled={pending || !canOpenBillingPortal}
      onClick={async () => {
        setPending(true)

        try {
          window.location.href = await openBillingPortal(orgSlug)
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to open billing portal.",
          )
          setPending(false)
        }
      }}
      variant="outline"
    >
      {pending ? "Opening billing…" : label}
    </Button>
  )
}

export interface WorkspaceCheckoutButtonProps {
  canManageBilling: boolean
  className?: string
  label: string
  orgSlug: string
  planKey: string
}

export function WorkspaceCheckoutButton({
  canManageBilling,
  className,
  label,
  orgSlug,
  planKey,
}: WorkspaceCheckoutButtonProps) {
  const [pending, setPending] = useState(false)

  return (
    <Button
      className={className}
      disabled={pending || !canManageBilling}
      onClick={async () => {
        setPending(true)

        try {
          window.location.href = await startBillingCheckout({
            orgSlug,
            planKey,
          })
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to start billing checkout.",
          )
          setPending(false)
        }
      }}
    >
      {pending ? "Redirecting…" : label}
    </Button>
  )
}
