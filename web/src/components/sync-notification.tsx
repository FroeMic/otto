"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FloatingStatusChip } from "@/components/floating-status-chip";

const MIN_DISPLAY_MS = 10_000;
const POLL_INTERVAL_MS = 1_000;

export function SyncNotification({
  jobId,
  message,
  onDone,
  orgSlug,
  statusUrl,
}: {
  jobId: string;
  message: string;
  onDone: () => void;
  orgSlug: string;
  statusUrl?: string;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const startedAt = useRef(Date.now());
  const doneRef = useRef(false);

  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const url =
          statusUrl ?? `/api/workspace/${orgSlug}/jobs/${jobId}/status`;
        const res = await fetch(url);
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
  }, [jobId, onDone, orgSlug, router, statusUrl]);

  if (!visible) return null;

  return <FloatingStatusChip message={message} />;
}
