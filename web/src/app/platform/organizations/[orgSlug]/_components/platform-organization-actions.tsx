"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type PlatformOrganizationActionsProps = {
  hasTenant: boolean;
  orgSlug: string;
  runtimeReady: boolean;
};

type OrganizationAction = "apply" | "refresh-image";

export function PlatformOrganizationActions({
  hasTenant,
  orgSlug,
  runtimeReady,
}: PlatformOrganizationActionsProps) {
  const router = useRouter();
  const [pendingAction, startTransition] = React.useTransition();

  const runAction = (action: OrganizationAction) => {
    startTransition(async () => {
      const endpoint =
        action === "apply"
          ? `/api/platform/organizations/${orgSlug}/apply`
          : `/api/platform/organizations/${orgSlug}/refresh-image`;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
        });
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;

        if (!response.ok) {
          throw new Error(
            body?.message ??
              `Platform action failed with status ${response.status}.`,
          );
        }

        toast.success(
          action === "apply"
            ? "Queued runtime apply."
            : "Runtime image refresh started.",
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Platform action failed.",
        );
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={!hasTenant || !runtimeReady || pendingAction}
        onClick={() => runAction("apply")}
        variant="default"
      >
        {pendingAction ? <Spinner data-icon="inline-start" /> : null}
        Apply tenant config
      </Button>
      <Button
        disabled={!hasTenant || !runtimeReady || pendingAction}
        onClick={() => runAction("refresh-image")}
        variant="outline"
      >
        {pendingAction ? <Spinner data-icon="inline-start" /> : null}
        Pull and restart image
      </Button>
    </div>
  );
}
