import type { WorkspaceChatMessage } from "@otto/feature-workspace-chat";
import { useEffect, useState } from "react";

import { getWorkspaceChatPendingLabel } from "../trace-presentation";

export interface ConversationPendingStateProps {
  startedAt: string;
  status: WorkspaceChatMessage["status"];
}

export function ConversationPendingState({
  startedAt,
  status,
}: ConversationPendingStateProps) {
  const isActive = status === "pending" || status === "streaming";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isActive]);

  const startedAtMs = Date.parse(startedAt);
  const elapsedMs =
    Number.isFinite(startedAtMs) && now >= startedAtMs ? now - startedAtMs : 0;
  const label = getWorkspaceChatPendingLabel({
    elapsedMs,
    status,
  });

  if (!label) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      {isActive ? (
        <div className="flex gap-1">
          <span className="size-2 animate-pulse rounded-full bg-muted-foreground/40 [animation-delay:-0.2s]" />
          <span className="size-2 animate-pulse rounded-full bg-muted-foreground/40 [animation-delay:-0.1s]" />
          <span className="size-2 animate-pulse rounded-full bg-muted-foreground/40" />
        </div>
      ) : null}
    </div>
  );
}
