"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ManagedSkillFilesTab } from "@/app/[orgSlug]/(app)/skills/_components/managed-skill-files-tab";
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
import { useSetBreadcrumbs } from "@/components/breadcrumb-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { IntegrationStickySaveBar } from "@/integrations/framework/ui/sticky-save-bar";
import {
  buildManagedSkillMarkdown,
  MANAGED_SKILL_ENTRY_FILE_PATH,
  parseManagedSkillMarkdown,
} from "@/lib/managed-skills/markdown";
import {
  buildManagedSkillSectionPath,
  isManagedSkillSection,
  type ManagedSkillSection,
} from "@/lib/managed-skills/routing";

type Props = {
  detail: {
    dependencies: {
      integrations: string[];
      skills: string[];
    };
    description: string;
    displayName: string;
    enabled: boolean;
    files: Array<{
      contentSha256: string | null;
      contentText: string | null;
      contentType: string | null;
      editability: "download_only" | "editable" | "local_state";
      path: string;
      storageEncoding: "binary" | "utf8_text";
    }>;
    skillKey: string;
    sourceType: "integration_contribution" | "system" | "user";
    status:
      | "disabled"
      | "invalid"
      | "missing_prerequisite"
      | "projection_failed"
      | "ready";
    summary: string | null;
    updatedAt: string;
    version: number;
  };
  knownIntegrationKeys: string[];
  knownSkillKeys: string[];
  orgSlug: string;
  section: ManagedSkillSection;
  updateAction: (formData: FormData) => Promise<void>;
};

const statusBadgeVariant: Record<
  Props["detail"]["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  disabled: "secondary",
  invalid: "destructive",
  missing_prerequisite: "outline",
  projection_failed: "destructive",
  ready: "default",
};

const bodyTextareaClassName =
  "min-h-[30rem] rounded-xl border-border bg-background font-mono text-sm leading-6";

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSourceLabel(sourceType: Props["detail"]["sourceType"]) {
  return sourceType === "integration_contribution"
    ? "Integration starter"
    : sourceType === "system"
      ? "System managed"
      : "Workspace managed";
}

function getStatusDescription(status: Props["detail"]["status"]) {
  switch (status) {
    case "ready":
      return "This skill is projected into the runtime and ready for Otto to use.";
    case "missing_prerequisite":
      return "This skill depends on an integration or prerequisite that is not currently available.";
    case "projection_failed":
      return "The last projection attempt failed. Otto is keeping the stored package, but the runtime needs attention.";
    case "invalid":
      return "The current package does not pass validation and needs to be fixed before Otto can rely on it.";
    case "disabled":
      return "This skill is stored for the workspace, but it is not active right now.";
  }
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ManagedSkillDetailPanel({
  detail,
  knownIntegrationKeys,
  knownSkillKeys,
  orgSlug,
  section,
  updateAction,
}: Props) {
  const setBreadcrumbs = useSetBreadcrumbs();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const skillEntryFile =
    detail.files.find((file) => file.path === MANAGED_SKILL_ENTRY_FILE_PATH) ??
    null;
  const parsedSkillDocument = useMemo(() => {
    if (
      !skillEntryFile ||
      skillEntryFile.storageEncoding !== "utf8_text" ||
      !skillEntryFile.contentText
    ) {
      return null;
    }

    try {
      return parseManagedSkillMarkdown(skillEntryFile.contentText);
    } catch {
      return null;
    }
  }, [skillEntryFile]);
  const [titleDraft, setTitleDraft] = useState("");
  const [skillDescriptionDraft, setSkillDescriptionDraft] = useState("");
  const [skillIntegrationKeysDraft, setSkillIntegrationKeysDraft] = useState<
    string[]
  >([]);
  const [skillInstructionsDraft, setSkillInstructionsDraft] = useState("");
  const [skillSkillKeysDraft, setSkillSkillKeysDraft] = useState<string[]>([]);
  const canEditOverview =
    skillEntryFile?.editability === "editable" &&
    skillEntryFile.storageEncoding === "utf8_text" &&
    parsedSkillDocument !== null;
  const nextContentText = useMemo(() => {
    if (!parsedSkillDocument) {
      return skillEntryFile?.contentText ?? "";
    }

    return buildManagedSkillMarkdown({
      description: skillDescriptionDraft,
      integrationKeys: skillIntegrationKeysDraft,
      name: titleDraft,
      skillBody: skillInstructionsDraft,
      skillKeys: skillSkillKeysDraft,
    });
  }, [
    parsedSkillDocument,
    skillDescriptionDraft,
    skillEntryFile?.contentText,
    skillInstructionsDraft,
    skillIntegrationKeysDraft,
    skillSkillKeysDraft,
    titleDraft,
  ]);
  const hasChanges =
    canEditOverview && nextContentText !== (skillEntryFile?.contentText ?? "");

  useEffect(() => {
    setBreadcrumbs([
      {
        href: `/${orgSlug}/skills`,
        label: "Skills",
      },
      {
        label: detail.displayName,
      },
    ]);

    return () => setBreadcrumbs([]);
  }, [detail.displayName, orgSlug, setBreadcrumbs]);

  useEffect(() => {
    setTitleDraft(parsedSkillDocument?.name ?? detail.displayName);
    setSkillDescriptionDraft(parsedSkillDocument?.description ?? "");
    setSkillIntegrationKeysDraft(parsedSkillDocument?.integrationKeys ?? []);
    setSkillInstructionsDraft(parsedSkillDocument?.skillBody ?? "");
    setSkillSkillKeysDraft(parsedSkillDocument?.skillKeys ?? []);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [detail.displayName, parsedSkillDocument]);

  function handleSectionChange(nextSection: string) {
    if (!isManagedSkillSection(nextSection) || nextSection === section) {
      return;
    }

    router.push(
      buildManagedSkillSectionPath({
        orgSlug,
        section: nextSection,
        skillKey: detail.skillKey,
      }),
    );
  }

  function resetOverviewDraft() {
    setTitleDraft(parsedSkillDocument?.name ?? detail.displayName);
    setSkillDescriptionDraft(parsedSkillDocument?.description ?? "");
    setSkillIntegrationKeysDraft(parsedSkillDocument?.integrationKeys ?? []);
    setSkillInstructionsDraft(parsedSkillDocument?.skillBody ?? "");
    setSkillSkillKeysDraft(parsedSkillDocument?.skillKeys ?? []);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleIntegrationToggle(
    integrationKey: string,
    checked: boolean | "indeterminate",
  ) {
    setSkillIntegrationKeysDraft((current) => {
      if (checked === true) {
        return [...new Set([...current, integrationKey])].sort((left, right) =>
          left.localeCompare(right),
        );
      }

      return current.filter((entry) => entry !== integrationKey);
    });
  }

  function handleSave() {
    if (!skillEntryFile || !canEditOverview) {
      return;
    }

    const formData = new FormData();
    formData.set("contentText", nextContentText);
    formData.set("expectedVersion", String(detail.version));
    formData.set("orgSlug", orgSlug);
    formData.set("relativePath", skillEntryFile.path);
    formData.set("skillKey", detail.skillKey);

    startTransition(async () => {
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        await updateAction(formData);
        setSuccessMessage("Skill overview saved.");
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Skill update failed",
        );
      }
    });
  }

  function handleSkillToggle(
    dependencySkillKey: string,
    checked: boolean | "indeterminate",
  ) {
    setSkillSkillKeysDraft((current) => {
      if (checked === true) {
        return [...new Set([...current, dependencySkillKey])].sort(
          (left, right) => left.localeCompare(right),
        );
      }

      return current.filter((entry) => entry !== dependencySkillKey);
    });
  }

  return (
    <SettingsPage className="mx-0 flex max-w-6xl flex-1 flex-col gap-6 pb-16">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <SettingsPageTitle>{detail.displayName}</SettingsPageTitle>
          <Badge variant={statusBadgeVariant[detail.status]}>
            {formatStatusLabel(detail.status)}
          </Badge>
          <Badge variant="secondary">
            {formatSourceLabel(detail.sourceType)}
          </Badge>
        </div>
        <p className="max-w-4xl text-sm text-muted-foreground">
          {detail.description}
        </p>
      </div>

      <Tabs onValueChange={handleSectionChange} value={section}>
        <TabsList className="h-auto justify-start overflow-x-auto p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>
      </Tabs>

      {section === "overview" ? (
        <div className="flex flex-col gap-6">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Save failed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          {successMessage ? (
            <Alert>
              <AlertTitle>Saved</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          ) : null}

          {!skillEntryFile ? (
            <Alert variant="destructive">
              <AlertTitle>SKILL.md missing</AlertTitle>
              <AlertDescription>
                This managed skill does not currently have a `SKILL.md` entry
                file to edit.
              </AlertDescription>
            </Alert>
          ) : parsedSkillDocument === null ? (
            <Alert variant="destructive">
              <AlertTitle>SKILL.md could not be parsed</AlertTitle>
              <AlertDescription>
                The workspace can only show the Overview editor for valid
                managed skill metadata. Open the Files tab to inspect the raw
                file contents.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {!canEditOverview ? (
                <Alert>
                  <AlertTitle>Read-only skill</AlertTitle>
                  <AlertDescription>
                    System-managed skills can be inspected here, but only
                    workspace-managed skills can be edited.
                  </AlertDescription>
                </Alert>
              ) : null}

              <SettingsSection>
                <SettingsSectionTitle>Basics</SettingsSectionTitle>
                <SettingsSectionDescription>
                  Manage the title, description, and body Otto stores in
                  `SKILL.md`.
                </SettingsSectionDescription>
                <SettingsCard className="divide-y-0 px-5 py-5">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="skill-overview-title">
                        Title
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          disabled={!canEditOverview || isPending}
                          id="skill-overview-title"
                          onChange={(event) =>
                            setTitleDraft(event.target.value)
                          }
                          value={titleDraft}
                        />
                        <FieldDescription>
                          Human-readable name stored in the skill frontmatter.
                        </FieldDescription>
                      </FieldContent>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="skill-overview-key">
                        Skill key
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          disabled
                          id="skill-overview-key"
                          value={detail.skillKey}
                        />
                        <FieldDescription>
                          Stable package path in the workspace runtime.
                        </FieldDescription>
                      </FieldContent>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="skill-overview-description">
                        Description
                      </FieldLabel>
                      <FieldContent>
                        <Textarea
                          className="min-h-28"
                          disabled={!canEditOverview || isPending}
                          id="skill-overview-description"
                          onChange={(event) =>
                            setSkillDescriptionDraft(event.target.value)
                          }
                          value={skillDescriptionDraft}
                        />
                        <FieldDescription>
                          Short guidance for when Otto should use this skill.
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldGroup>
                </SettingsCard>
              </SettingsSection>

              <SettingsSection>
                <SettingsSectionTitle>Dependencies</SettingsSectionTitle>
                <SettingsSectionDescription>
                  Declare the integrations and other managed skills this skill
                  expects in the workspace.
                </SettingsSectionDescription>
                <SettingsCard className="divide-y-0 px-5 py-5">
                  <div className="flex flex-col gap-6">
                    <FieldSet>
                      <FieldLegend>Integration dependencies</FieldLegend>
                      <FieldDescription>
                        Optional integrations Otto should expect before using
                        this skill.
                      </FieldDescription>
                      {canEditOverview ? (
                        knownIntegrationKeys.length > 0 ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {knownIntegrationKeys.map((integrationKey) => (
                              <Field
                                key={integrationKey}
                                orientation="horizontal"
                              >
                                <Checkbox
                                  checked={skillIntegrationKeysDraft.includes(
                                    integrationKey,
                                  )}
                                  disabled={isPending}
                                  id={`skill-overview-integration-${integrationKey}`}
                                  onCheckedChange={(nextChecked) =>
                                    handleIntegrationToggle(
                                      integrationKey,
                                      nextChecked,
                                    )
                                  }
                                />
                                <FieldLabel
                                  htmlFor={`skill-overview-integration-${integrationKey}`}
                                >
                                  {integrationKey}
                                </FieldLabel>
                              </Field>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No workspace integrations are available to declare
                            yet.
                          </p>
                        )
                      ) : skillIntegrationKeysDraft.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {skillIntegrationKeysDraft.map((integrationKey) => (
                            <Badge key={integrationKey} variant="outline">
                              {integrationKey}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No integration dependencies declared.
                        </p>
                      )}
                    </FieldSet>

                    <FieldSet>
                      <FieldLegend>Skill dependencies</FieldLegend>
                      <FieldDescription>
                        Other managed skills this skill expects to exist first.
                      </FieldDescription>
                      {canEditOverview ? (
                        knownSkillKeys.length > 0 ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {knownSkillKeys.map((dependencySkillKey) => (
                              <Field
                                key={dependencySkillKey}
                                orientation="horizontal"
                              >
                                <Checkbox
                                  checked={skillSkillKeysDraft.includes(
                                    dependencySkillKey,
                                  )}
                                  disabled={isPending}
                                  id={`skill-overview-skill-${dependencySkillKey}`}
                                  onCheckedChange={(nextChecked) =>
                                    handleSkillToggle(
                                      dependencySkillKey,
                                      nextChecked,
                                    )
                                  }
                                />
                                <FieldLabel
                                  htmlFor={`skill-overview-skill-${dependencySkillKey}`}
                                >
                                  {dependencySkillKey}
                                </FieldLabel>
                              </Field>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No other managed skills exist in this workspace yet.
                          </p>
                        )
                      ) : skillSkillKeysDraft.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {skillSkillKeysDraft.map((dependencySkillKey) => (
                            <Badge key={dependencySkillKey} variant="outline">
                              {dependencySkillKey}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No managed skill dependencies declared.
                        </p>
                      )}
                    </FieldSet>
                  </div>
                </SettingsCard>
              </SettingsSection>

              <SettingsSection>
                <SettingsSectionTitle>Instructions</SettingsSectionTitle>
                <SettingsSectionDescription>
                  Edit the markdown body that appears below the frontmatter
                  header in `SKILL.md`.
                </SettingsSectionDescription>
                <SettingsCard className="divide-y-0 px-5 py-5">
                  <Field>
                    <FieldLabel htmlFor="skill-overview-body">
                      Skill body
                    </FieldLabel>
                    <FieldContent>
                      <Textarea
                        className={bodyTextareaClassName}
                        disabled={!canEditOverview || isPending}
                        id="skill-overview-body"
                        onChange={(event) =>
                          setSkillInstructionsDraft(event.target.value)
                        }
                        value={skillInstructionsDraft}
                      />
                      <FieldDescription>
                        The markdown instructions Otto sees after the generated
                        metadata header.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </SettingsCard>
              </SettingsSection>

              <IntegrationStickySaveBar
                description="Review the changes, then save or discard them."
                hasChanges={hasChanges}
                isPending={isPending}
                onDiscard={resetOverviewDraft}
                onSave={handleSave}
                title="You have unsaved skill changes."
              />
            </>
          )}
        </div>
      ) : null}

      {section === "files" ? (
        <SettingsSection>
          <SettingsSectionTitle>Runtime files</SettingsSectionTitle>
          <SettingsSectionDescription>
            Explore the projected skill directory exactly as Otto sees it in the
            workspace runtime. This viewer is read-only for now.
          </SettingsSectionDescription>
          <ManagedSkillFilesTab orgSlug={orgSlug} skillKey={detail.skillKey} />
        </SettingsSection>
      ) : null}

      {section === "status" ? (
        <div className="flex flex-col gap-8">
          <SettingsSection>
            <SettingsSectionTitle>Status</SettingsSectionTitle>
            <SettingsSectionDescription>
              Current workspace status for this managed skill package.
            </SettingsSectionDescription>
            <SettingsCard>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Current status</SettingsRowTitle>
                  <SettingsRowDescription>
                    {getStatusDescription(detail.status)}
                  </SettingsRowDescription>
                </SettingsRowLabel>
                <Badge variant={statusBadgeVariant[detail.status]}>
                  {formatStatusLabel(detail.status)}
                </Badge>
              </SettingsRow>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Current version</SettingsRowTitle>
                  <SettingsRowDescription>
                    Latest stored package version in the workspace.
                  </SettingsRowDescription>
                </SettingsRowLabel>
                <div className="text-sm text-muted-foreground">
                  v{detail.version}
                </div>
              </SettingsRow>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Package files</SettingsRowTitle>
                  <SettingsRowDescription>
                    Managed files currently stored for this skill.
                  </SettingsRowDescription>
                </SettingsRowLabel>
                <div className="text-sm text-muted-foreground">
                  {detail.files.length}
                </div>
              </SettingsRow>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Last updated</SettingsRowTitle>
                  <SettingsRowDescription>
                    Most recent workspace-side package change.
                  </SettingsRowDescription>
                </SettingsRowLabel>
                <div className="text-sm text-muted-foreground">
                  {formatUpdatedAt(detail.updatedAt)}
                </div>
              </SettingsRow>
              <SettingsRow>
                <SettingsRowLabel>
                  <SettingsRowTitle>Latest summary</SettingsRowTitle>
                  <SettingsRowDescription>
                    Summary recorded with the current package version.
                  </SettingsRowDescription>
                </SettingsRowLabel>
                <div className="max-w-xl text-right text-sm text-muted-foreground">
                  {detail.summary ?? "No summary recorded."}
                </div>
              </SettingsRow>
            </SettingsCard>
          </SettingsSection>

          <SettingsSection>
            <SettingsSectionTitle>Dependencies</SettingsSectionTitle>
            <SettingsSectionDescription>
              Integrations and managed skills this skill expects to exist in the
              workspace.
            </SettingsSectionDescription>
            <SettingsCard className="flex flex-col gap-5 divide-y-0 px-5 py-5">
              <div className="flex flex-col gap-3">
                <div className="text-sm font-medium text-foreground">
                  Integration prerequisites
                </div>
                {detail.dependencies.integrations.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {detail.dependencies.integrations.map((integrationKey) => (
                      <Badge key={integrationKey} variant="outline">
                        {integrationKey}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This skill does not declare any integration prerequisites.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="text-sm font-medium text-foreground">
                  Skill prerequisites
                </div>
                {detail.dependencies.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {detail.dependencies.skills.map((dependencySkillKey) => (
                      <Badge key={dependencySkillKey} variant="outline">
                        {dependencySkillKey}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This skill does not declare any managed skill prerequisites.
                  </p>
                )}
              </div>
            </SettingsCard>
          </SettingsSection>
        </div>
      ) : null}
    </SettingsPage>
  );
}
