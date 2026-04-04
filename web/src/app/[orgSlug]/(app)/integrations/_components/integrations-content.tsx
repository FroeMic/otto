"use client";

import { PlugsConnected } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ToolbarSearchInput } from "@/components/toolbar-search-input";

export type CapabilitySummary = {
  reads: number;
  tools: number;
  triggers: number;
};

export type SurfaceEntry = {
  availability?: "available" | "blocked";
  capabilitySummary?: CapabilitySummary;
  description: string;
  enabled: boolean;
  id: string;
  installState: "installed" | "uninstalled";
  key: string;
  kind: string;
  label: string;
  settingsUrl?: string | null;
  surfaceType: "global" | "integration" | "tool";
  uiGroup: "integrations" | "tools";
};

type IntegrationsContentProps = {
  orgSlug: string;
  surfaces: SurfaceEntry[];
};

const brandIconMap: Record<string, string> = {
  slack: "/integrations/slack.svg",
  whatsapp: "/integrations/whatsapp.png",
  "web-search": "/integrations/web-search.svg",
};

function getSurfaceHref(surface: SurfaceEntry, orgSlug: string) {
  if (surface.settingsUrl) return surface.settingsUrl;
  return `/${orgSlug}/tools/${surface.kind}/${surface.key}`;
}

function isInstalled(surface: SurfaceEntry) {
  return (
    surface.installState === "installed" &&
    (surface.enabled || surface.availability === "available")
  );
}

type CategorySection = {
  key: string;
  label: string;
  surfaces: SurfaceEntry[];
};

function categorize(surfaces: SurfaceEntry[]): CategorySection[] {
  const sections: CategorySection[] = [];

  const installed = surfaces.filter(isInstalled);
  if (installed.length > 0) {
    sections.push({
      key: "installed",
      label: "Installed",
      surfaces: installed,
    });
  }

  const messaging = surfaces.filter((s) => s.uiGroup === "integrations");
  if (messaging.length > 0) {
    sections.push({
      key: "messaging",
      label: "Messaging",
      surfaces: messaging,
    });
  }

  return sections;
}

function SurfaceIcon({ surface }: { surface: SurfaceEntry }) {
  const brandSrc = brandIconMap[surface.key];

  if (brandSrc) {
    return (
      <Image
        alt={surface.label}
        className="size-6"
        height={24}
        src={brandSrc}
        width={24}
      />
    );
  }

  return <PlugsConnected className="size-5 text-foreground" />;
}

function CapabilitySummaryRow({ summary }: { summary: CapabilitySummary }) {
  const parts: string[] = [];
  if (summary.triggers > 0)
    parts.push(
      `${summary.triggers} trigger${summary.triggers !== 1 ? "s" : ""}`,
    );
  if (summary.tools > 0)
    parts.push(`${summary.tools} tool${summary.tools !== 1 ? "s" : ""}`);
  if (summary.reads > 0)
    parts.push(`${summary.reads} read${summary.reads !== 1 ? "s" : ""}`);
  if (parts.length === 0) return null;

  return (
    <p className="mt-auto text-xs text-muted-foreground">{parts.join(" · ")}</p>
  );
}

function IntegrationCard({
  orgSlug,
  surface,
}: {
  orgSlug: string;
  surface: SurfaceEntry;
}) {
  const href = getSurfaceHref(surface, orgSlug);
  const installed = isInstalled(surface);

  return (
    <Link
      className="flex h-48 flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50"
      href={href}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <SurfaceIcon surface={surface} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">{surface.label}</span>
          {installed ? (
            <span className="text-xs font-medium text-emerald-600">
              Installed
            </span>
          ) : null}
        </div>
      </div>
      <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {surface.description}
      </p>
      {surface.capabilitySummary ? (
        <CapabilitySummaryRow summary={surface.capabilitySummary} />
      ) : null}
    </Link>
  );
}

export function IntegrationsContent({
  orgSlug,
  surfaces,
}: IntegrationsContentProps) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter.trim()) return surfaces;
    const q = filter.toLowerCase();
    return surfaces.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [surfaces, filter]);

  const sections = useMemo(() => categorize(filtered), [filtered]);

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Integrations
          </h1>
          <p className="text-sm text-muted-foreground">
            Connect the tools your team already uses to Otto.
          </p>
        </div>
        <ToolbarSearchInput
          aria-label="Search integrations"
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search integrations..."
          value={filter}
        />
      </div>

      {sections.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No integrations match your search.
        </p>
      ) : (
        <div className="flex flex-col" style={{ gap: "2rem" }}>
          {sections.map((section) => (
            <section key={section.key}>
              <h2 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {section.label}
              </h2>
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, 240px)",
                }}
              >
                {section.surfaces.map((surface) => (
                  <IntegrationCard
                    key={surface.id}
                    orgSlug={orgSlug}
                    surface={surface}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
