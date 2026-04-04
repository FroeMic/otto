"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { SyncNotification } from "@/components/sync-notification";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PlatformOrganizationActionsProps = {
  hasTenant: boolean;
  orgSlug: string;
  runtimeReady: boolean;
};

type OrganizationAction = "apply" | "refresh-image";

const ACTION_LABELS: Record<OrganizationAction, string> = {
  apply: "Applying Config",
  "refresh-image": "Pulling and Restarting Image",
};

export function PlatformOrganizationActions({
  hasTenant,
  orgSlug,
  runtimeReady,
}: PlatformOrganizationActionsProps) {
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");

  const runAction = async (action: OrganizationAction) => {
    const endpoint =
      action === "apply"
        ? `/api/platform/organizations/${orgSlug}/apply`
        : `/api/platform/organizations/${orgSlug}/refresh-image`;

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        jobId?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.message ??
            `Platform action failed with status ${response.status}.`,
        );
      }

      if (body?.jobId) {
        setSyncMessage(ACTION_LABELS[action]);
        setSyncJobId(body.jobId);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Platform action failed.",
      );
    }
  };

  const handleDone = useCallback(() => {
    setSyncJobId(null);
    setSyncMessage("");
  }, []);

  return (
    <>
      {syncJobId ? (
        <SyncNotification
          jobId={syncJobId}
          message={syncMessage}
          onDone={handleDone}
          orgSlug={orgSlug}
          statusUrl={`/api/platform/organizations/${orgSlug}/jobs/${syncJobId}/status`}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Open organization actions"
              size="icon-sm"
              variant="ghost"
              disabled={syncJobId !== null}
            />
          }
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!hasTenant || !runtimeReady || syncJobId !== null}
            onClick={() => runAction("apply")}
          >
            Apply tenant config
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasTenant || !runtimeReady || syncJobId !== null}
            onClick={() => runAction("refresh-image")}
          >
            Pull and restart image
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
