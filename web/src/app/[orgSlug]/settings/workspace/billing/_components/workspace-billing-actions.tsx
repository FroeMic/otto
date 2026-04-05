"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { BillingPlanKey } from "@/lib/billing/plans";

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];
type ButtonSize = React.ComponentProps<typeof Button>["size"];

type WorkspaceManageBillingButtonProps = {
  canOpenBillingPortal: boolean;
  label?: string;
  orgSlug: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

type WorkspaceCheckoutButtonProps = {
  canManageBilling: boolean;
  label: string;
  orgSlug: string;
  planKey: BillingPlanKey;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function WorkspaceManageBillingButton({
  canOpenBillingPortal,
  label = "Manage billing",
  orgSlug,
  size = "default",
  variant = "outline",
}: WorkspaceManageBillingButtonProps) {
  const [pending, setPending] = useState(false);

  const openBillingPortal = async () => {
    setPending(true);

    try {
      const response = await fetch(`/api/workspace/${orgSlug}/billing/portal`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        url?: string | null;
      } | null;

      if (!response.ok || !body?.url) {
        throw new Error(body?.message ?? "Failed to open billing portal.");
      }

      window.location.href = body.url;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to open billing portal.",
      );
      setPending(false);
    }
  };

  return (
    <Button
      disabled={pending || !canOpenBillingPortal}
      onClick={openBillingPortal}
      size={size}
      variant={variant}
    >
      {pending ? "Opening billing…" : label}
    </Button>
  );
}

export function WorkspaceCheckoutButton({
  canManageBilling,
  label,
  orgSlug,
  planKey,
  size = "default",
  variant = "default",
}: WorkspaceCheckoutButtonProps) {
  const [pending, setPending] = useState(false);

  const startCheckout = async () => {
    setPending(true);

    try {
      const response = await fetch(
        `/api/workspace/${orgSlug}/billing/checkout`,
        {
          body: JSON.stringify({ planKey }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        url?: string | null;
      } | null;

      if (!response.ok || !body?.url) {
        throw new Error(body?.message ?? "Failed to start billing checkout.");
      }

      window.location.href = body.url;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start billing checkout.",
      );
      setPending(false);
    }
  };

  return (
    <Button
      disabled={pending || !canManageBilling}
      onClick={startCheckout}
      size={size}
      variant={variant}
    >
      {pending ? "Redirecting…" : label}
    </Button>
  );
}
