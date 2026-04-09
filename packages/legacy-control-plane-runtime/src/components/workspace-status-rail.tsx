import Image from "next/image";
import Link from "next/link";

import { Badge } from "./ui/badge";
import { buttonVariants } from "./ui/button-variants";
import type { DashboardOrganization } from "../db/control-plane";
import { cn } from "../lib/utils";
import {
  getAgentReadinessSummary,
  getConnectedMessagingSurfaces,
  getSlackErrorMessage,
} from "../lib/workspace";

type StatusRailModel = {
  badgeLabel: string;
  message?: string;
  variant: "default" | "secondary" | "destructive" | "outline";
};

function getStatusRailModel(
  organization: DashboardOrganization,
): StatusRailModel {
  const readiness = getAgentReadinessSummary(organization);
  const slackError = getSlackErrorMessage(organization);

  if (slackError) {
    return {
      badgeLabel: "Needs attention",
      message: "Slack connection needs attention.",
      variant: "destructive",
    };
  }

  if (readiness.label === "Needs attention") {
    return {
      badgeLabel: readiness.label,
      message: "A recent Otto update needs attention.",
      variant: readiness.variant,
    };
  }

  if (readiness.label === "Updating") {
    return {
      badgeLabel: readiness.label,
      message: "Applying a recent change.",
      variant: readiness.variant,
    };
  }

  if (!organization.slackIntegration?.connectedAt) {
    return {
      badgeLabel: "Setup required",
      message: "Connect Slack to finish setup.",
      variant: "outline",
    };
  }

  if (
    readiness.label === "Setup required" ||
    readiness.label === "Unavailable"
  ) {
    return {
      badgeLabel: "Setup required",
      message: "Otto is still getting ready.",
      variant: readiness.variant,
    };
  }

  return {
    badgeLabel: "Ready",
    variant: readiness.variant,
  };
}

export function WorkspaceStatusRail({
  organization,
}: {
  organization: DashboardOrganization;
}) {
  const status = getStatusRailModel(organization);
  const surfaces = getConnectedMessagingSurfaces(organization);

  return (
    <footer className="sticky bottom-0 z-10 shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="overflow-x-auto px-4 py-3 md:px-6">
        <div className="flex w-full min-w-max items-center gap-3 whitespace-nowrap">
          <div className="flex min-w-0 items-center gap-3">
            <Badge className="shrink-0" variant={status.variant}>
              {status.badgeLabel === "Ready" ? (
                <>
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-emerald-500"
                  />
                  {status.badgeLabel}
                </>
              ) : (
                status.badgeLabel
              )}
            </Badge>
            {status.message ? (
              <p className="truncate text-sm text-muted-foreground">
                {status.message}
              </p>
            ) : null}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {surfaces.map((surface) => (
              <Link
                key={surface.key}
                className={cn(
                  buttonVariants({ size: "xs", variant: "outline" }),
                  "h-5 gap-1.5 px-2 text-xs",
                )}
                href={surface.href}
                rel={surface.external ? "noreferrer" : undefined}
                target={surface.external ? "_blank" : undefined}
              >
                <Image
                  alt=""
                  className="size-3 shrink-0"
                  height={12}
                  src={surface.iconSrc}
                  width={12}
                />
                <span>{surface.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
