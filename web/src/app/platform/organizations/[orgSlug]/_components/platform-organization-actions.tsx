"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
            : "Queued runtime image refresh.",
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open organization actions"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        {pendingAction ? (
          <Spinner />
        ) : (
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={!hasTenant || !runtimeReady || pendingAction}
          onClick={() => runAction("apply")}
        >
          Apply tenant config
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasTenant || !runtimeReady || pendingAction}
          onClick={() => runAction("refresh-image")}
        >
          Pull and restart image
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
