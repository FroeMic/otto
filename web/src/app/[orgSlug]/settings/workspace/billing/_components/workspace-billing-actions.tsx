"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { BillingPlanKey } from "@/lib/billing/plans";

type WorkspaceBillingActionsProps = {
  canManageBilling: boolean;
  canOpenBillingPortal: boolean;
  currentPlanKey: BillingPlanKey | null;
  orgSlug: string;
};

export function WorkspaceBillingActions({
  canManageBilling,
  canOpenBillingPortal,
  currentPlanKey,
  orgSlug,
}: WorkspaceBillingActionsProps) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const hasActiveSubscription = currentPlanKey !== null;

  const startCheckout = async (planKey: BillingPlanKey) => {
    setPendingKey(planKey);

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
      setPendingKey(null);
    }
  };

  const openBillingPortal = async () => {
    setPendingKey("portal");

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
      setPendingKey(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={pendingKey !== null || !canOpenBillingPortal}
        onClick={openBillingPortal}
        variant="outline"
      >
        {pendingKey === "portal" ? "Opening billing…" : "Manage billing"}
      </Button>
      <Button
        disabled={
          pendingKey !== null || hasActiveSubscription || !canManageBilling
        }
        onClick={() => startCheckout("starter_monthly")}
        variant={currentPlanKey === "starter_monthly" ? "secondary" : "outline"}
      >
        {pendingKey === "starter_monthly" ? "Redirecting…" : "Choose Starter"}
      </Button>
      <Button
        disabled={
          pendingKey !== null || hasActiveSubscription || !canManageBilling
        }
        onClick={() => startCheckout("growth_monthly")}
        variant={currentPlanKey === "growth_monthly" ? "secondary" : "outline"}
      >
        {pendingKey === "growth_monthly" ? "Redirecting…" : "Choose Growth"}
      </Button>
      <Button
        disabled={
          pendingKey !== null || hasActiveSubscription || !canManageBilling
        }
        onClick={() => startCheckout("scale_monthly")}
        variant={currentPlanKey === "scale_monthly" ? "secondary" : "default"}
      >
        {pendingKey === "scale_monthly" ? "Redirecting…" : "Choose Scale"}
      </Button>
    </div>
  );
}
