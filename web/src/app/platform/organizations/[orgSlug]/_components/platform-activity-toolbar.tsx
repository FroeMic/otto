"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Switch } from "@/components/ui/switch";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlatformActivityToolbarProps = {
  orgSlug: string;
};

function buildHref(input: {
  orgSlug: string;
  type?: string | null;
  view: string;
}) {
  const searchParams = new URLSearchParams();

  if (input.type && input.type !== "all") {
    searchParams.set("type", input.type);
  }

  searchParams.set("view", input.view);

  const query = searchParams.toString();

  return `/platform/organizations/${input.orgSlug}/activity${query ? `?${query}` : ""}`;
}

export function PlatformActivityToolbar({
  orgSlug,
}: PlatformActivityToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  const view = searchParams.get("view") === "events" ? "events" : "jobs";
  const type = searchParams.get("type") === "apply" ? "apply" : "all";

  useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshEnabled, router]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <ButtonGroup>
          <Link
            className={cn(
              buttonVariants({
                variant: view === "jobs" ? "default" : "outline",
              }),
            )}
            href={buildHref({ orgSlug, type, view: "jobs" })}
          >
            Jobs
          </Link>
          <Link
            className={cn(
              buttonVariants({
                variant: view === "events" ? "default" : "outline",
              }),
            )}
            href={buildHref({ orgSlug, type: "all", view: "events" })}
          >
            Events
          </Link>
        </ButtonGroup>
        {view === "jobs" ? (
          <ButtonGroup>
            <Link
              className={cn(
                buttonVariants({
                  variant: type === "all" ? "default" : "outline",
                }),
              )}
              href={buildHref({ orgSlug, type: "all", view: "jobs" })}
            >
              All jobs
            </Link>
            <Link
              className={cn(
                buttonVariants({
                  variant: type === "apply" ? "default" : "outline",
                }),
              )}
              href={buildHref({ orgSlug, type: "apply", view: "jobs" })}
            >
              Apply only
            </Link>
          </ButtonGroup>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ButtonGroupText>
          <span className="text-xs text-muted-foreground">Live updates</span>
          <Switch
            checked={autoRefreshEnabled}
            onCheckedChange={setAutoRefreshEnabled}
            size="sm"
          />
        </ButtonGroupText>
        <Button onClick={() => router.refresh()} variant="outline">
          Refresh now
        </Button>
      </div>
    </div>
  );
}
