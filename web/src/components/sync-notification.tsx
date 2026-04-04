"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon } from "@hugeicons/core-free-icons";

const MIN_DISPLAY_MS = 10_000;
const POLL_INTERVAL_MS = 1_000;

export function SyncNotification({
  jobId,
  message,
  onDone,
  orgSlug,
}: {
  jobId: string;
  message: string;
  onDone: () => void;
  orgSlug: string;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const startedAt = useRef(Date.now());
  const doneRef = useRef(false);

  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/workspace/${orgSlug}/jobs/${jobId}/status`,
        );
        if (!res.ok) return;

        const data = (await res.json()) as {
          ok: boolean;
          status: string;
          error: string | null;
        };

        if (
          data.status !== "queued" &&
          data.status !== "running" &&
          !doneRef.current
        ) {
          doneRef.current = true;

          const elapsed = Date.now() - startedAt.current;
          const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

          setTimeout(() => {
            setVisible(false);
            router.refresh();

            if (data.status === "failed") {
              toast.error("Sync failed", {
                description: data.error ?? "The sync job failed.",
              });
            }

            onDone();
          }, remaining);
        }
      } catch {
        // ignore transient fetch errors, keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [jobId, orgSlug, onDone, router]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg border bg-background px-4 py-2.5 shadow-lg">
        <HugeiconsIcon
          icon={Loading03Icon}
          className="size-4 animate-spin text-muted-foreground"
        />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
