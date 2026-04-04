"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function RefreshScheduledTasksButton({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/workspace/${orgSlug}/scheduled-tasks/refresh`,
          { method: "POST" },
        );
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          jobId?: string;
          ok?: boolean;
        } | null;

        if (!response.ok || !body?.ok) {
          throw new Error(
            body?.error ?? `Refresh failed with status ${response.status}.`,
          );
        }

        toast.success("Scheduled task refresh started.", {
          description: `Job ${body.jobId} queued. Reload in a moment to see updated runtime data.`,
        });
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to refresh scheduled tasks.",
        );
      }
    });
  };

  return (
    <Button disabled={isPending} onClick={handleRefresh} variant="outline">
      {isPending ? "Refreshing..." : "Refresh from runtime"}
    </Button>
  );
}
