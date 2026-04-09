import { redirect } from "next/navigation";
import { loadOrganizationRouteContext } from "../../_lib/organization-context";
import {
  SettingsCard,
  SettingsPage,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "../../settings/_components/settings-layout";
import { getTenantManagedIntegrationSummary } from "../../../../db/control-plane";
import {
  buildIntegrationOverviewEntry,
  isPlatformManagedIntegration,
  listWorkspaceIntegrationDefinitions,
  resolvePlatformManagedIntegrationStatus,
} from "../../../../integrations/framework";
import { isOrganizationUnlocked } from "../../../../lib/workspace";
import { Integrations2SearchInput } from "./_components/integrations2-search-input";

export const dynamic = "force-dynamic";

function categorize<
  T extends {
    categoryLabel: string;
    key: string;
  },
>(entries: T[]) {
  const grouped = new Map<string, T[]>();

  for (const entry of entries) {
    const current = grouped.get(entry.categoryLabel) ?? [];
    current.push(entry);
    grouped.set(entry.categoryLabel, current);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, group]) => ({
      entries: group.sort((left, right) => left.key.localeCompare(right.key)),
      label,
    }));
}

export default async function Integrations2Page({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { currentOrganization: organization, user } =
    await loadOrganizationRouteContext(orgSlug);
  const searchQuery = Array.isArray(resolvedSearchParams.q)
    ? (resolvedSearchParams.q[0] ?? "")
    : (resolvedSearchParams.q ?? "");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const definitions = listWorkspaceIntegrationDefinitions();
  const summaries = await Promise.all(
    definitions.map((definition) => {
      if (isPlatformManagedIntegration(definition)) {
        return Promise.resolve(null);
      }

      return getTenantManagedIntegrationSummary({
        orgSlug,
        providerKey: definition.key,
        userExternalId: user.id,
      });
    }),
  );

  const entries = definitions
    .map((definition, index) => {
      const summary = summaries[index] ?? null;
      const OverviewItem = definition.ui?.overviewItem;

      if (!OverviewItem) {
        return null;
      }

      const entry = buildIntegrationOverviewEntry({
        connected: isPlatformManagedIntegration(definition)
          ? (resolvePlatformManagedIntegrationStatus(definition)?.connected ??
            false)
          : Boolean(summary?.connectedAt && !summary?.disconnectedAt),
        definition,
        needsAttention: isPlatformManagedIntegration(definition)
          ? (resolvePlatformManagedIntegrationStatus(definition)
              ?.needsAttention ?? false)
          : Boolean(summary?.lastError || summary?.status === "error"),
        orgSlug: organization.slug,
      });

      if (
        normalizedQuery &&
        !entry.label.toLowerCase().includes(normalizedQuery) &&
        !entry.description.toLowerCase().includes(normalizedQuery)
      ) {
        return null;
      }

      return {
        definition,
        entry,
      };
    })
    .filter((item) => item !== null);

  const sections = categorize(
    entries.map((item) => ({
      categoryLabel: item.entry.categoryLabel,
      key: item.entry.key,
      ...item,
    })),
  );

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
        <Integrations2SearchInput initialValue={searchQuery} />
      </div>

      {sections.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No integrations match your search.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <SettingsSection key={section.label}>
              <SettingsSectionTitle>{section.label}</SettingsSectionTitle>
              <SettingsSectionDescription>
                {section.label === "Messaging"
                  ? "Connect the channels where your team already works with Otto."
                  : "Connect the product tools Otto can use to plan, summarize, and follow up on work."}
              </SettingsSectionDescription>
              <SettingsCard>
                {section.entries.map(({ definition, entry }) => {
                  const OverviewItem = definition.ui?.overviewItem;

                  if (!OverviewItem) {
                    return null;
                  }

                  return <OverviewItem key={entry.key} entry={entry} />;
                })}
              </SettingsCard>
            </SettingsSection>
          ))}
        </div>
      )}
    </SettingsPage>
  );
}
