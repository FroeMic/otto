import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WebSearchRuntimeConfig } from "@/lib/web-search-config";
import type { ToolSurfacePageProps } from "@/tools/types";

export function WebSearchToolPage({
  orgSlug: _orgSlug,
  surface,
}: ToolSurfacePageProps<WebSearchRuntimeConfig>) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-12">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Tools / Web Search</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {surface.label}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {surface.description}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Availability</CardTitle>
          <CardDescription>
            {surface.availability === "available"
              ? "This tool is enabled for tenant runtimes."
              : "This tool is currently unavailable."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Provider:{" "}
            <span className="font-medium text-foreground">
              {surface.config.provider ?? "Not configured"}
            </span>
          </p>
          <p>
            Managed by:{" "}
            <span className="font-medium text-foreground">
              {surface.config.managedBy}
            </span>
          </p>
          <p>
            User edits:{" "}
            <span className="font-medium text-foreground">
              {surface.canUserEdit ? "Allowed" : "Not allowed"}
            </span>
          </p>
          <p>
            Agent edits:{" "}
            <span className="font-medium text-foreground">
              {surface.canAgentEdit ? "Allowed" : "Not allowed"}
            </span>
          </p>
          {surface.blockingReason ? (
            <p className="text-foreground">{surface.blockingReason}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Effective runtime config</CardTitle>
          <CardDescription>
            This is the non-secret Brave web search configuration Otto projects
            into tenant runtimes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Default results:{" "}
            <span className="font-medium text-foreground">
              {surface.config.maxResults ?? "OpenClaw default"}
            </span>
          </p>
          <p>
            Timeout:{" "}
            <span className="font-medium text-foreground">
              {surface.config.timeoutSeconds
                ? `${surface.config.timeoutSeconds}s`
                : "OpenClaw default"}
            </span>
          </p>
          <p>
            Cache TTL:{" "}
            <span className="font-medium text-foreground">
              {surface.config.cacheTtlMinutes !== undefined
                ? `${surface.config.cacheTtlMinutes} min`
                : "OpenClaw default"}
            </span>
          </p>
          <p>
            Credential env var:{" "}
            <span className="font-medium text-foreground">
              {surface.config.credentialEnvVar ?? "Unavailable"}
            </span>
          </p>
          {surface.config.braveMode ? (
            <p>
              Brave mode:{" "}
              <span className="font-medium text-foreground">
                {surface.config.braveMode}
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/${_orgSlug}/tools`}
        >
          View all tools
        </Link>
      </div>
    </div>
  );
}
