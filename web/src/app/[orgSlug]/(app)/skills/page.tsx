import { withAuth } from "@workos-inc/authkit-nextjs";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadOrganizationRouteContext } from "@/app/[orgSlug]/_lib/organization-context";
import { CreateSkillButton } from "@/app/[orgSlug]/(app)/skills/_components/create-skill-button";
import {
  SettingsCard,
  SettingsPage,
  SettingsPageTitle,
  SettingsRow,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "@/app/[orgSlug]/settings/_components/settings-layout";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { createTenantManagedSkill } from "@/db/control-plane";
import {
  listTenantManagedSkillKeysForTenant,
  listTenantManagedSkillsForTenant,
} from "@/db/managed-skills";
import { buildManagedSkillMarkdown } from "@/lib/managed-skills/markdown";
import { listKnownManagedSkillDependencyIntegrationKeys } from "@/lib/managed-skills/package";
import { buildManagedSkillSectionPath } from "@/lib/managed-skills/routing";
import { getPrimaryAgent, isOrganizationUnlocked } from "@/lib/workspace";

export const dynamic = "force-dynamic";

async function createManagedSkillAction(formData: FormData) {
  "use server";

  const { user } = await withAuth({ ensureSignedIn: true });
  const description = formData.get("description")?.toString();
  const integrationKeys = formData
    .getAll("integrationKeys")
    .map((value) => value.toString())
    .filter(Boolean);
  const skillKeys = formData
    .getAll("skillKeys")
    .map((value) => value.toString())
    .filter(Boolean);
  const orgSlug = formData.get("orgSlug")?.toString();
  const skillBody = formData.get("skillBody")?.toString();
  const skillKey = formData.get("skillKey")?.toString();

  if (!description || !orgSlug || !skillBody || !skillKey) {
    throw new Error("Managed skill creation is missing required fields");
  }

  const skillContent = buildManagedSkillMarkdown({
    description,
    integrationKeys,
    name: skillKey,
    skillKeys,
    skillBody,
  });
  const createdSkill = await createTenantManagedSkill({
    orgSlug,
    skillContent,
    skillKey,
    userExternalId: user.id,
  });

  revalidatePath(`/${orgSlug}/skills`);
  revalidatePath(
    buildManagedSkillSectionPath({
      orgSlug,
      section: "overview",
      skillKey: createdSkill.skillKey,
    }),
  );

  return {
    skillKey: createdSkill.skillKey,
  };
}

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  disabled: "secondary",
  invalid: "destructive",
  missing_prerequisite: "outline",
  projection_failed: "destructive",
  ready: "default",
};

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSourceLabel(sourceType: string) {
  return sourceType === "integration_contribution"
    ? "Integration starter"
    : sourceType === "system"
      ? "System managed"
      : "Workspace managed";
}

export default async function SkillsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { currentOrganization: organization } =
    await loadOrganizationRouteContext(orgSlug);

  if (!isOrganizationUnlocked(organization)) {
    redirect(`/${organization.slug}/onboarding`);
  }

  const primaryAgent = getPrimaryAgent(organization);
  const knownIntegrationKeys = listKnownManagedSkillDependencyIntegrationKeys();
  const skills = primaryAgent
    ? await listTenantManagedSkillsForTenant({
        tenantId: primaryAgent.id,
      })
    : [];
  const knownSkillKeys = primaryAgent
    ? await listTenantManagedSkillKeysForTenant({
        tenantId: primaryAgent.id,
      })
    : [];

  return (
    <SettingsPage className="mx-0 flex max-w-4xl flex-1 flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <SettingsPageTitle>Skills</SettingsPageTitle>
          <p className="text-sm text-muted-foreground">
            Review and edit the reusable skill packages Otto keeps for this
            workspace.
          </p>
        </div>
        {primaryAgent ? (
          <CreateSkillButton
            createAction={createManagedSkillAction}
            knownIntegrationKeys={knownIntegrationKeys}
            knownSkillKeys={knownSkillKeys}
            orgSlug={organization.slug}
          />
        ) : null}
      </div>

      {!primaryAgent ? (
        <SettingsSection>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowLabel>
                <SettingsRowTitle>No Otto runtime yet</SettingsRowTitle>
                <SettingsRowDescription>
                  Skills will appear here once Otto has been provisioned for
                  this workspace.
                </SettingsRowDescription>
              </SettingsRowLabel>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      ) : skills.length === 0 ? (
        <SettingsSection>
          <SettingsSectionTitle>Managed skills</SettingsSectionTitle>
          <SettingsSectionDescription>
            Reusable skill packages will appear here after they are added for
            this workspace.
          </SettingsSectionDescription>
          <SettingsCard className="p-6">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No skills yet</EmptyTitle>
                <EmptyDescription>
                  Create the first `SKILL.md` package here, then open it in the
                  new detail view to inspect and edit it.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </SettingsCard>
        </SettingsSection>
      ) : (
        <SettingsSection>
          <SettingsSectionTitle>Managed skills</SettingsSectionTitle>
          <SettingsSectionDescription>
            Open a skill package to inspect its files, check prerequisites, and
            edit SKILL.md where the package is workspace-managed.
          </SettingsSectionDescription>
          <SettingsCard>
            {skills.map((skill) => (
              <Link
                key={skill.skillKey}
                className="block transition-colors hover:bg-muted/30"
                href={buildManagedSkillSectionPath({
                  orgSlug: organization.slug,
                  section: "overview",
                  skillKey: skill.skillKey,
                })}
              >
                <SettingsRow>
                  <SettingsRowLabel>
                    <div className="flex flex-wrap items-center gap-2">
                      <SettingsRowTitle>{skill.displayName}</SettingsRowTitle>
                      <Badge
                        variant={statusBadgeVariant[skill.status] ?? "outline"}
                      >
                        {formatStatusLabel(skill.status)}
                      </Badge>
                      <Badge variant="secondary">
                        {formatSourceLabel(skill.sourceType)}
                      </Badge>
                    </div>
                    <SettingsRowDescription>
                      {skill.description}
                    </SettingsRowDescription>
                  </SettingsRowLabel>
                  <div className="text-right text-sm text-muted-foreground">
                    Open
                  </div>
                </SettingsRow>
              </Link>
            ))}
          </SettingsCard>
        </SettingsSection>
      )}
    </SettingsPage>
  );
}
