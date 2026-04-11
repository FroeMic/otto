import { useSuspenseQuery } from "@tanstack/react-query"
import { useLocation } from "@tanstack/react-router"

import {
  SettingsPage,
  SettingsPageContent,
} from "@/client/app/app-shell/SettingsLayout"

import { workspaceIntegrationsQueryOptions } from "../api/integrations"
import { IntegrationCatalogSection } from "../components/IntegrationCatalogSection"
import { IntegrationsSearchInput } from "../components/IntegrationsSearchInput"
import { integrationOverviewRegistry } from "../registry"

export interface IntegrationsPageProps {
  orgSlug: string
}

function categorize<
  T extends {
    categoryLabel: string
    key: string
  },
>(entries: T[]) {
  const grouped = new Map<string, T[]>()

  for (const entry of entries) {
    const current = grouped.get(entry.categoryLabel) ?? []
    current.push(entry)
    grouped.set(entry.categoryLabel, current)
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, group]) => ({
      entries: group.sort((left, right) => left.key.localeCompare(right.key)),
      label,
    }))
}

export function IntegrationsPage({ orgSlug }: IntegrationsPageProps) {
  const { data } = useSuspenseQuery(workspaceIntegrationsQueryOptions(orgSlug))
  const location = useLocation()
  const searchQuery = new URLSearchParams(location.searchStr).get("q") ?? ""
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const entries = data.filter((entry) => {
    if (!normalizedQuery) {
      return true
    }

    return (
      entry.label.toLowerCase().includes(normalizedQuery) ||
      entry.description.toLowerCase().includes(normalizedQuery)
    )
  })
  const sections = categorize(entries)

  return (
    <SettingsPage>
      <SettingsPageContent className="flex max-w-3xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
            <p className="text-sm text-muted-foreground">
              Connect the tools your team already uses to Otto.
            </p>
          </div>
          <IntegrationsSearchInput initialValue={searchQuery} />
        </div>

        {sections.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No integrations match your search.
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            {sections.map((section) => (
              <IntegrationCatalogSection
                key={section.label}
                description={
                  section.label === "Messaging"
                    ? "Connect the channels where your team already works with Otto."
                    : "Connect the product tools Otto can use to plan, summarize, and follow up on work."
                }
                entries={section.entries}
                renderItem={(entry) => {
                  const OverviewItem = integrationOverviewRegistry[entry.key]

                  return <OverviewItem key={entry.key} entry={entry} />
                }}
                title={section.label}
              />
            ))}
          </div>
        )}
      </SettingsPageContent>
    </SettingsPage>
  )
}
