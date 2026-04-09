"use client";

import { PlugsConnected } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  SettingsCard,
  SettingsPage,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { ToolbarSearchInput } from "@/components/toolbar-search-input";
import { Badge } from "@/components/ui/badge";

export type CapabilitySummary = {
  reads: number;
  tools: number;
  triggers: number;
};

export type SurfaceEntry = {
  availability?: "available" | "blocked";
  categoryLabel?: string;
  capabilitySummary?: CapabilitySummary;
  description: string;
  enabled: boolean;
  id: string;
  installState: "installed" | "uninstalled";
  key: string;
  kind: string;
  label: string;
  settingsUrl?: string | null;
  surfaceType: "global" | "integration";
  uiGroup: "integrations";
};

type IntegrationsContentProps = {
  orgSlug: string;
  surfaces: SurfaceEntry[];
};

const brandIconMap: Record<string, string> = {
  brave: "/integrations/web-search.svg",
  linear: "/integrations/linear.svg",
  slack: "/integrations/slack.svg",
};

function getSurfaceHref(surface: SurfaceEntry, orgSlug: string) {
  if (surface.settingsUrl) return surface.settingsUrl;
  if (surface.surfaceType === "integration") {
    return `/${orgSlug}/integrations/${surface.key}`;
  }
  return `/${orgSlug}/integrations2`;
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
  const grouped = new Map<string, SurfaceEntry[]>();

  for (const surface of surfaces) {
    const categoryLabel = surface.categoryLabel ?? "Messaging";
    const current = grouped.get(categoryLabel) ?? [];
    current.push(surface);
    grouped.set(categoryLabel, current);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, entries]) => ({
      key: label.toLowerCase().replace(/\s+/g, "-"),
      label,
      surfaces: entries.sort((left, right) =>
        left.label.localeCompare(right.label),
      ),
    }));
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

function IntegrationRow({
  orgSlug,
  surface,
}: {
  orgSlug: string;
  surface: SurfaceEntry;
}) {
  const href = getSurfaceHref(surface, orgSlug);
  const installed = isInstalled(surface);
  const capabilityLabel = surface.capabilitySummary
    ? [
        surface.capabilitySummary.triggers
          ? `${surface.capabilitySummary.triggers} trigger${surface.capabilitySummary.triggers !== 1 ? "s" : ""}`
          : null,
        surface.capabilitySummary.tools
          ? `${surface.capabilitySummary.tools} tool${surface.capabilitySummary.tools !== 1 ? "s" : ""}`
          : null,
        surface.capabilitySummary.reads
          ? `${surface.capabilitySummary.reads} read${surface.capabilitySummary.reads !== 1 ? "s" : ""}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <Link
      className="flex items-center justify-between gap-4 px-5 py-5 transition-colors hover:bg-accent/30"
      href={href}
    >
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <SurfaceIcon surface={surface} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{surface.label}</span>
            {installed ? <Badge variant="outline">Connected</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{surface.description}</p>
        </div>
      </div>
      {capabilityLabel ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {capabilityLabel}
        </span>
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
    <SettingsPage className="mx-0 flex max-w-3xl flex-1 flex-col gap-8">
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
        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <SettingsSection key={section.key}>
              <SettingsSectionTitle>{section.label}</SettingsSectionTitle>
              <SettingsSectionDescription>
                {section.label === "Messaging"
                  ? "Connect the channels where your team already works with Otto."
                  : "Connect the product tools Otto can use to plan, summarize, and follow up on work."}
              </SettingsSectionDescription>
              <SettingsCard className="rounded-2xl">
                {section.surfaces.map((surface) => (
                  <IntegrationRow
                    key={surface.id}
                    orgSlug={orgSlug}
                    surface={surface}
                  />
                ))}
              </SettingsCard>
            </SettingsSection>
          ))}
        </div>
      )}
    </SettingsPage>
  );
}
