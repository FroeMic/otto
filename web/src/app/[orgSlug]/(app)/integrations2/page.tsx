import { redirect } from "next/navigation";
import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import {
  SettingsCard,
  SettingsPage,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { getTenantManagedIntegrationSummary } from "@/db/control-plane";
import {
  buildIntegrationOverviewEntry,
  listWorkspaceIntegrationDefinitions,
} from "@/integrations/framework";
import { isOrganizationUnlocked } from "@/lib/workspace";

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
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization, user } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const definitions = listWorkspaceIntegrationDefinitions();
  const summaries = await Promise.all(
    definitions.map((definition) =>
      getTenantManagedIntegrationSummary({
        orgSlug,
        providerKey: definition.key,
        userExternalId: user.id,
      }),
    ),
  );

  const entries = definitions.map((definition, index) => {
    const summary = summaries[index] ?? null;

    return {
      definition,
      entry: buildIntegrationOverviewEntry({
        connected: Boolean(summary?.connectedAt && !summary?.disconnectedAt),
        definition,
        needsAttention: Boolean(
          summary?.lastError || summary?.status === "error",
        ),
        orgSlug: organization.slug,
      }),
    };
  });

  const sections = categorize(
    entries.map((item) => ({
      categoryLabel: item.entry.categoryLabel,
      key: item.entry.key,
      ...item,
    })),
  );

  return (
    <SettingsPage className="mx-0 flex max-w-3xl flex-1 flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations2</h1>
        <p className="text-sm text-muted-foreground">
          Registry-backed managed integrations with provider-owned overview and
          detail UI.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <SettingsSection key={section.label}>
            <SettingsSectionTitle>{section.label}</SettingsSectionTitle>
            <SettingsSectionDescription>
              {section.label === "Messaging"
                ? "Connect the channels where your team already works with Otto."
                : "Connect the product tools Otto can use to plan, summarize, and follow up on work."}
            </SettingsSectionDescription>
            <SettingsCard className="rounded-2xl">
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
    </SettingsPage>
  );
}
