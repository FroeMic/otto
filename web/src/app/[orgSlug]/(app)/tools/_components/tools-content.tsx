"use client";

import { PlugsConnected } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  CapabilitySummary,
  SurfaceEntry,
} from "@/app/[orgSlug]/(app)/integrations/_components/integrations-content";
import { ToolbarSearchInput } from "@/components/toolbar-search-input";

const brandIconMap: Record<string, string> = {};

function getSurfaceHref(surface: SurfaceEntry, orgSlug: string) {
  if (surface.settingsUrl) return surface.settingsUrl;
  return `/${orgSlug}/tools/${surface.kind}/${surface.key}`;
}

function isAvailable(surface: SurfaceEntry) {
  return (
    surface.installState === "installed" &&
    (surface.enabled || surface.availability === "available")
  );
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

function ToolCard({
  orgSlug,
  surface,
}: {
  orgSlug: string;
  surface: SurfaceEntry;
}) {
  const href = getSurfaceHref(surface, orgSlug);
  const available = isAvailable(surface);

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
          {available ? (
            <span className="text-xs font-medium text-emerald-600">
              Available
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

type ToolsContentProps = {
  orgSlug: string;
  surfaces: SurfaceEntry[];
};

export function ToolsContent({ orgSlug, surfaces }: ToolsContentProps) {
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

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
          <p className="text-sm text-muted-foreground">
            Runtime capabilities Otto can use.
          </p>
        </div>
        <ToolbarSearchInput
          aria-label="Search tools"
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search tools..."
          value={filter}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {filter.trim()
            ? "No tools match your search."
            : "No tools available yet."}
        </p>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, 240px)",
          }}
        >
          {filtered.map((surface) => (
            <ToolCard key={surface.id} orgSlug={orgSlug} surface={surface} />
          ))}
        </div>
      )}
    </div>
  );
}
