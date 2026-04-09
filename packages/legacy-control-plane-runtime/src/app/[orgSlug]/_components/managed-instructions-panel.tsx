import { withAuth } from "@workos-inc/authkit-nextjs";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { ManagedInstructionsEditor } from "./managed-instructions-editor";
import { getAgentInstructionTabBySlug } from "../(app)/agent/_lib/agent-instruction-tabs";
import {
  SettingsPage,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionTitle,
} from "../settings/_components/settings-layout";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  type DashboardOrganization,
  getLatestTenantManagedConfig,
  updateTenantManagedFileSharedContent,
} from "../../../db/control-plane";
import { normalizeManagedBootstrapFilePath } from "../../../lib/openclaw/managed-config";
import { getPrimaryAgent } from "../../../lib/workspace";

async function updateManagedInstructionAction(formData: FormData) {
  "use server";

  const { user } = await withAuth({ ensureSignedIn: true });
  const orgSlug = formData.get("orgSlug")?.toString();
  const filePath = formData.get("filePath")?.toString();
  const expectedVersionValue = formData.get("expectedVersion")?.toString();
  const instructionTabSlug = formData.get("instructionTabSlug")?.toString();
  const sharedContent = formData.get("sharedContent")?.toString();

  if (!orgSlug || !filePath || !sharedContent) {
    throw new Error("Managed instruction update is missing required fields");
  }

  const normalizedFilePath = normalizeManagedBootstrapFilePath(filePath);

  if (!normalizedFilePath) {
    throw new Error(`Unsupported managed instruction file: ${filePath}`);
  }

  await updateTenantManagedFileSharedContent({
    expectedVersion: expectedVersionValue
      ? Number.parseInt(expectedVersionValue, 10)
      : undefined,
    filePath: normalizedFilePath,
    orgSlug,
    sharedContent,
    userExternalId: user.id,
  });

  revalidatePath(`/${orgSlug}/agent`);

  if (instructionTabSlug) {
    revalidatePath(
      `/${orgSlug}/agent/${encodeURIComponent(instructionTabSlug)}`,
    );
  }
}

type ManagedInstructionsPanelProps = {
  instructionTabSlug: string;
  organization: DashboardOrganization;
  orgSlug: string;
  selectedFilePath: string;
};

export async function ManagedInstructionsPanel({
  instructionTabSlug,
  organization,
  orgSlug,
  selectedFilePath,
}: ManagedInstructionsPanelProps) {
  const primaryAgent = getPrimaryAgent(organization);
  const managedConfig = primaryAgent
    ? await getLatestTenantManagedConfig(primaryAgent.id)
    : null;

  if (!primaryAgent || !managedConfig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Otto instructions</CardTitle>
          <CardDescription>
            These instruction files will appear once Otto has been set up for
            this workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const selectedTab = getAgentInstructionTabBySlug(instructionTabSlug);
  const selectedFile = managedConfig.files.find(
    (file) => file.path === selectedFilePath,
  );

  if (!selectedTab || !selectedFile) {
    notFound();
  }

  return (
    <SettingsPage className="mx-0 max-w-2xl">
      <div className="flex flex-col gap-8 pb-8">
        <SettingsSection>
          <SettingsSectionTitle>{selectedTab.label}</SettingsSectionTitle>
          <SettingsSectionDescription>
            {selectedFile.description}
          </SettingsSectionDescription>
        </SettingsSection>

        <ManagedInstructionsEditor
          expectedVersion={managedConfig.version}
          filePath={selectedFile.path}
          instructionTabSlug={instructionTabSlug}
          orgSlug={orgSlug}
          sharedContent={selectedFile.sharedContent}
          systemContent={selectedFile.systemContent}
          updateAction={updateManagedInstructionAction}
        />
      </div>
    </SettingsPage>
  );
}
