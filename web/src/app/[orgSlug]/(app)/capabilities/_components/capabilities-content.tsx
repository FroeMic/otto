"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";

import type { AgentCapability, AgentCapabilityDirection } from "@/tools/types";

type CapabilityGroup = {
  capabilities: AgentCapability[];
  key: string;
  label: string;
};

type CapabilitiesContentProps = {
  groups: CapabilityGroup[];
};

const directionLabels: Record<AgentCapabilityDirection, string> = {
  trigger: "Trigger",
  tool: "Tool",
  read: "Read",
};

const directionColors: Record<AgentCapabilityDirection, string> = {
  trigger: "text-amber-600",
  tool: "text-blue-600",
  read: "text-emerald-600",
};

function CapabilityRow({ capability }: { capability: AgentCapability }) {
  return (
    <div className="flex items-start gap-4 rounded-lg border bg-card p-4">
      <span
        className={`shrink-0 text-xs font-medium uppercase tracking-wider ${directionColors[capability.direction]}`}
        style={{ minWidth: "3.5rem" }}
      >
        {directionLabels[capability.direction]}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{capability.label}</span>
        <span className="text-sm text-muted-foreground">
          {capability.description}
        </span>
        {capability.conditionNote ? (
          <span className="text-xs text-muted-foreground/70">
            {capability.conditionNote}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CapabilitiesContent({ groups }: CapabilitiesContentProps) {
  const [filter, setFilter] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const filteredGroups = useMemo(() => {
    if (!filter.trim()) return groups;
    const q = filter.toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        capabilities: group.capabilities.filter(
          (c) =>
            c.label.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.capabilities.length > 0);
  }, [groups, filter]);

  const totalCount = groups.reduce(
    (sum, g) => sum + g.capabilities.length,
    0,
  );

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Capabilities
          </h1>
          <p className="text-sm text-muted-foreground">
            Runtime capabilities your agent can use.{" "}
            <span className="font-medium text-foreground">
              {totalCount} total
            </span>{" "}
            across native tools and integrations.
          </p>
        </div>
        <div
          className="flex max-w-md items-center gap-2 rounded-lg border bg-input/50 px-3 py-2 transition-shadow"
          style={
            searchFocused
              ? { borderColor: "var(--primary)" }
              : undefined
          }
        >
          <HugeiconsIcon
            className="size-4 shrink-0 text-muted-foreground"
            icon={Search01Icon}
          />
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onBlur={() => setSearchFocused(false)}
            onChange={(e) => setFilter(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="Search capabilities..."
            value={filter}
          />
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No capabilities match your search.
        </p>
      ) : (
        <div className="flex flex-col" style={{ gap: "2rem" }}>
          {filteredGroups.map((group) => (
            <section key={group.key}>
              <h2 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h2>
              <div className="flex flex-col gap-2">
                {group.capabilities.map((cap) => (
                  <CapabilityRow key={cap.key} capability={cap} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
