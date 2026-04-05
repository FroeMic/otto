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
        onClick={() => startCheckout("basic_monthly")}
        variant={currentPlanKey === "basic_monthly" ? "secondary" : "outline"}
      >
        {pendingKey === "basic_monthly" ? "Redirecting…" : "Choose Basic"}
      </Button>
      <Button
        disabled={
          pendingKey !== null || hasActiveSubscription || !canManageBilling
        }
        onClick={() => startCheckout("plus_monthly")}
        variant={currentPlanKey === "plus_monthly" ? "secondary" : "outline"}
      >
        {pendingKey === "plus_monthly" ? "Redirecting…" : "Choose Plus"}
      </Button>
      <Button
        disabled={
          pendingKey !== null || hasActiveSubscription || !canManageBilling
        }
        onClick={() => startCheckout("pro_monthly")}
        variant={currentPlanKey === "pro_monthly" ? "secondary" : "outline"}
      >
        {pendingKey === "pro_monthly" ? "Redirecting…" : "Choose Pro"}
      </Button>
      <Button
        disabled={
          pendingKey !== null || hasActiveSubscription || !canManageBilling
        }
        onClick={() => startCheckout("max_monthly")}
        variant={currentPlanKey === "max_monthly" ? "secondary" : "default"}
      >
        {pendingKey === "max_monthly" ? "Redirecting…" : "Choose Max"}
      </Button>
    </div>
  );
}
