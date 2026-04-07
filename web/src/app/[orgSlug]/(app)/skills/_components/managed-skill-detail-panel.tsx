"use client";

import {
  type ReadonlyURLSearchParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useEffect, useState, useTransition } from "react";

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
import { Button } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  buildManagedSkillMarkdown,
  MANAGED_SKILL_ENTRY_FILE_PATH,
  parseManagedSkillMarkdown,
} from "@/lib/managed-skills/markdown";
import { cn } from "@/lib/utils";

type Props = {
  detail: {
    dependencies: {
      integrations: string[];
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
    sourceType: "integration_contribution" | "user";
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
  orgSlug: string;
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

function updateQueryString(
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
  updates: Record<string, string | null>,
) {
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      params.delete(key);
      continue;
    }

    params.set(key, value);
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSourceLabel(sourceType: Props["detail"]["sourceType"]) {
  return sourceType === "integration_contribution"
    ? "Integration starter"
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

const lockedTextareaClassName = [
  "min-h-[28rem] rounded-xl border-border bg-muted/40 font-mono text-xs leading-5 md:text-xs",
  "disabled:cursor-default disabled:opacity-100 disabled:border-border disabled:bg-muted/20 disabled:text-foreground",
].join(" ");

const compactReadOnlyTextareaClassName = [
  "min-h-24 rounded-xl border-border bg-muted/40 text-sm leading-6",
  "disabled:cursor-default disabled:opacity-100 disabled:border-border disabled:bg-muted/20 disabled:text-foreground",
].join(" ");

export function ManagedSkillDetailPanel({
  detail,
  knownIntegrationKeys,
  orgSlug,
  updateAction,
}: Props) {
  const setBreadcrumbs = useSetBreadcrumbs();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftValue, setDraftValue] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [skillDescriptionDraft, setSkillDescriptionDraft] = useState("");
  const [skillIntegrationKeysDraft, setSkillIntegrationKeysDraft] = useState<
    string[]
  >([]);
  const [skillInstructionsDraft, setSkillInstructionsDraft] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const tabParam = searchParams.get("tab");
  const fileParam = searchParams.get("file");
  const currentTab: "files" | "status" =
    tabParam === "status" ? "status" : "files";
  const selectedFile =
    detail.files.find((file) => file.path === fileParam) ??
    detail.files[0] ??
    null;
  const selectedSkillDocument =
    selectedFile?.path === MANAGED_SKILL_ENTRY_FILE_PATH &&
    selectedFile.storageEncoding === "utf8_text" &&
    selectedFile.contentText
      ? (() => {
          try {
            return parseManagedSkillMarkdown(selectedFile.contentText);
          } catch {
            return null;
          }
        })()
      : null;
  const isStructuredSkillEntry =
    selectedFile?.path === MANAGED_SKILL_ENTRY_FILE_PATH &&
    selectedFile.editability === "editable" &&
    selectedFile.storageEncoding === "utf8_text" &&
    selectedSkillDocument !== null;

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
    const nextFilePath = selectedFile?.path ?? null;

    if (tabParam && tabParam !== "files" && tabParam !== "status") {
      router.replace(
        updateQueryString(pathname, searchParams, {
          file: nextFilePath,
          tab: "files",
        }),
        { scroll: false },
      );
      return;
    }

    if (detail.files.length > 0 && fileParam !== nextFilePath) {
      router.replace(
        updateQueryString(pathname, searchParams, {
          file: nextFilePath,
        }),
        { scroll: false },
      );
    }
  }, [
    detail.files.length,
    fileParam,
    pathname,
    router,
    searchParams,
    selectedFile?.path,
    tabParam,
  ]);

  useEffect(() => {
    setDraftValue(selectedFile?.contentText ?? "");
    setSkillDescriptionDraft(selectedSkillDocument?.description ?? "");
    setSkillIntegrationKeysDraft(selectedSkillDocument?.integrationKeys ?? []);
    setSkillInstructionsDraft(selectedSkillDocument?.skillBody ?? "");
    setErrorMessage(null);
    setIsEditing(false);
    setSuccessMessage(null);
  }, [selectedFile, selectedSkillDocument]);

  function handleTabChange(nextTab: string) {
    router.replace(
      updateQueryString(pathname, searchParams, {
        tab: nextTab,
      }),
      { scroll: false },
    );
  }

  function handleFileSelect(nextPath: string) {
    if (isPending) {
      return;
    }

    router.replace(
      updateQueryString(pathname, searchParams, {
        file: nextPath,
      }),
      { scroll: false },
    );
  }

  function handleCancelEdit() {
    setDraftValue(selectedFile?.contentText ?? "");
    setSkillDescriptionDraft(selectedSkillDocument?.description ?? "");
    setSkillIntegrationKeysDraft(selectedSkillDocument?.integrationKeys ?? []);
    setSkillInstructionsDraft(selectedSkillDocument?.skillBody ?? "");
    setErrorMessage(null);
    setIsEditing(false);
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
    if (!selectedFile || selectedFile.editability !== "editable") {
      return;
    }

    const nextContentText = isStructuredSkillEntry
      ? buildManagedSkillMarkdown({
          description: skillDescriptionDraft,
          integrationKeys: skillIntegrationKeysDraft,
          name: selectedSkillDocument.name,
          skillBody: skillInstructionsDraft,
        })
      : draftValue;
    const formData = new FormData();
    formData.set("contentText", nextContentText);
    formData.set("expectedVersion", String(detail.version));
    formData.set("orgSlug", orgSlug);
    formData.set("relativePath", selectedFile.path);
    formData.set("skillKey", detail.skillKey);

    startTransition(async () => {
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        await updateAction(formData);
        setIsEditing(false);
        setSuccessMessage(`Saved ${selectedFile.path}.`);
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Skill update failed",
        );
      }
    });
  }

  return (
    <SettingsPage className="mx-0 flex max-w-6xl flex-1 flex-col gap-6">
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

      <Tabs onValueChange={handleTabChange} value={currentTab}>
        <TabsList className="h-auto justify-start overflow-x-auto p-1">
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
            <SettingsSection>
              <SettingsSectionTitle>Package files</SettingsSectionTitle>
              <SettingsSectionDescription>
                Select a file to inspect it. Editable managed text files can be
                changed here.
              </SettingsSectionDescription>
              <SettingsCard className="overflow-hidden">
                <ScrollArea className="max-h-[34rem]">
                  <div className="flex flex-col">
                    {detail.files.map((file) => {
                      const isActive = selectedFile?.path === file.path;

                      return (
                        <button
                          key={file.path}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                            isActive ? "bg-muted/40" : "hover:bg-muted/20",
                          )}
                          onClick={() => handleFileSelect(file.path)}
                          type="button"
                        >
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="truncate font-mono text-xs text-foreground">
                              {file.path}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {file.editability === "editable"
                                ? "Editable text"
                                : "Download-only file"}
                            </span>
                          </div>
                          <Badge
                            variant={
                              file.editability === "editable"
                                ? "outline"
                                : "secondary"
                            }
                          >
                            {file.editability === "editable" ? "Edit" : "View"}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </SettingsCard>
            </SettingsSection>

            <SettingsSection>
              <SettingsSectionTitle>Viewer</SettingsSectionTitle>
              <SettingsSectionDescription>
                Review the selected file and edit it when the package allows
                managed text updates.
              </SettingsSectionDescription>
              <div className="flex flex-col gap-4">
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
                {selectedFile ? (
                  <div className="flex flex-col gap-4">
                    <SettingsCard className="divide-y-0">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="font-mono text-sm text-foreground">
                            {selectedFile.path}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {selectedFile.contentType ??
                              (selectedFile.storageEncoding === "utf8_text"
                                ? "text/plain"
                                : "application/octet-stream")}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              selectedFile.editability === "editable"
                                ? "outline"
                                : "secondary"
                            }
                          >
                            {selectedFile.editability === "editable"
                              ? "Editable"
                              : "Read only"}
                          </Badge>
                          {selectedFile.editability === "editable" ? (
                            isEditing ? (
                              <>
                                <Button
                                  disabled={isPending}
                                  onClick={handleCancelEdit}
                                  type="button"
                                  variant="outline"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  disabled={
                                    isPending ||
                                    nextContentTextValue({
                                      draftValue,
                                      selectedFile,
                                      selectedSkillDocument,
                                      skillDescriptionDraft,
                                      skillInstructionsDraft,
                                      skillIntegrationKeysDraft,
                                    }) === (selectedFile.contentText ?? "")
                                  }
                                  onClick={handleSave}
                                  type="button"
                                >
                                  Save changes
                                </Button>
                              </>
                            ) : (
                              <Button
                                onClick={() => setIsEditing(true)}
                                type="button"
                                variant="outline"
                              >
                                Edit file
                              </Button>
                            )
                          ) : null}
                        </div>
                      </div>
                    </SettingsCard>

                    {selectedFile.storageEncoding === "utf8_text" ? (
                      isStructuredSkillEntry ? (
                        <SettingsCard className="divide-y-0 px-5 py-5">
                          <div className="flex flex-col gap-6">
                            <FieldGroup>
                              <Field>
                                <FieldLabel htmlFor="skill-detail-key">
                                  Skill key
                                </FieldLabel>
                                <FieldContent>
                                  <Input
                                    disabled
                                    id="skill-detail-key"
                                    value={detail.skillKey}
                                  />
                                  <FieldDescription>
                                    Stable package path for this skill.
                                  </FieldDescription>
                                </FieldContent>
                              </Field>

                              <Field>
                                <FieldLabel htmlFor="skill-detail-description">
                                  Description
                                </FieldLabel>
                                <FieldContent>
                                  {isEditing ? (
                                    <Textarea
                                      className="min-h-24"
                                      id="skill-detail-description"
                                      onChange={(event) =>
                                        setSkillDescriptionDraft(
                                          event.target.value,
                                        )
                                      }
                                      value={skillDescriptionDraft}
                                    />
                                  ) : (
                                    <Textarea
                                      className={
                                        compactReadOnlyTextareaClassName
                                      }
                                      disabled
                                      id="skill-detail-description"
                                      value={skillDescriptionDraft}
                                    />
                                  )}
                                  <FieldDescription>
                                    Short guidance for when Otto should use this
                                    skill.
                                  </FieldDescription>
                                </FieldContent>
                              </Field>
                            </FieldGroup>

                            <FieldSet>
                              <FieldLegend>
                                Integration dependencies
                              </FieldLegend>
                              <FieldDescription>
                                Optional prerequisites Otto should expect before
                                using this skill.
                              </FieldDescription>
                              {isEditing ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                  {knownIntegrationKeys.map(
                                    (integrationKey) => {
                                      const checked =
                                        skillIntegrationKeysDraft.includes(
                                          integrationKey,
                                        );

                                      return (
                                        <Field
                                          key={integrationKey}
                                          orientation="horizontal"
                                        >
                                          <Checkbox
                                            checked={checked}
                                            id={`skill-detail-dependency-${integrationKey}`}
                                            onCheckedChange={(nextChecked) =>
                                              handleIntegrationToggle(
                                                integrationKey,
                                                nextChecked,
                                              )
                                            }
                                          />
                                          <FieldLabel
                                            htmlFor={`skill-detail-dependency-${integrationKey}`}
                                          >
                                            {integrationKey}
                                          </FieldLabel>
                                        </Field>
                                      );
                                    },
                                  )}
                                </div>
                              ) : skillIntegrationKeysDraft.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {skillIntegrationKeysDraft.map(
                                    (integrationKey) => (
                                      <Badge
                                        key={integrationKey}
                                        variant="outline"
                                      >
                                        {integrationKey}
                                      </Badge>
                                    ),
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No integration prerequisites declared.
                                </p>
                              )}
                            </FieldSet>

                            <Field>
                              <FieldLabel htmlFor="skill-detail-body">
                                Skill instructions
                              </FieldLabel>
                              <FieldContent>
                                {isEditing ? (
                                  <Textarea
                                    className={lockedTextareaClassName}
                                    id="skill-detail-body"
                                    onChange={(event) =>
                                      setSkillInstructionsDraft(
                                        event.target.value,
                                      )
                                    }
                                    value={skillInstructionsDraft}
                                  />
                                ) : (
                                  <Textarea
                                    className={lockedTextareaClassName}
                                    disabled
                                    id="skill-detail-body"
                                    value={skillInstructionsDraft}
                                  />
                                )}
                                <FieldDescription>
                                  Main markdown body stored below the generated
                                  metadata header.
                                </FieldDescription>
                              </FieldContent>
                            </Field>
                          </div>
                        </SettingsCard>
                      ) : isEditing ? (
                        <Textarea
                          className={lockedTextareaClassName}
                          onChange={(event) =>
                            setDraftValue(event.target.value)
                          }
                          value={draftValue}
                        />
                      ) : (
                        <Textarea
                          className={lockedTextareaClassName}
                          value={selectedFile.contentText ?? ""}
                          disabled
                          readOnly
                        />
                      )
                    ) : (
                      <SettingsCard className="divide-y-0 px-5 py-5">
                        <p className="text-sm text-muted-foreground">
                          This file is stored as binary content in the package.
                          The current slice only supports metadata visibility in
                          the workspace UI.
                        </p>
                      </SettingsCard>
                    )}
                  </div>
                ) : (
                  <SettingsCard className="divide-y-0 px-5 py-5">
                    <p className="text-sm text-muted-foreground">
                      This skill has no projected package files yet.
                    </p>
                  </SettingsCard>
                )}
              </div>
            </SettingsSection>
          </div>
        </TabsContent>

        <TabsContent value="status">
          <SettingsPage className="mx-0 max-w-none">
            <div className="flex flex-col gap-8 pb-8">
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
                  Integrations this skill expects to exist in the workspace.
                </SettingsSectionDescription>
                <SettingsCard className="divide-y-0 px-5 py-5">
                  {detail.dependencies.integrations.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {detail.dependencies.integrations.map(
                        (integrationKey) => (
                          <Badge key={integrationKey} variant="outline">
                            {integrationKey}
                          </Badge>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This skill does not declare any integration prerequisites.
                    </p>
                  )}
                </SettingsCard>
              </SettingsSection>
            </div>
          </SettingsPage>
        </TabsContent>
      </Tabs>
    </SettingsPage>
  );
}

function nextContentTextValue(input: {
  draftValue: string;
  selectedFile: Props["detail"]["files"][number];
  selectedSkillDocument: ReturnType<typeof parseManagedSkillMarkdown> | null;
  skillDescriptionDraft: string;
  skillInstructionsDraft: string;
  skillIntegrationKeysDraft: string[];
}) {
  if (
    input.selectedFile.path === MANAGED_SKILL_ENTRY_FILE_PATH &&
    input.selectedFile.editability === "editable" &&
    input.selectedFile.storageEncoding === "utf8_text" &&
    input.selectedSkillDocument
  ) {
    return buildManagedSkillMarkdown({
      description: input.skillDescriptionDraft,
      integrationKeys: input.skillIntegrationKeysDraft,
      name: input.selectedSkillDocument.name,
      skillBody: input.skillInstructionsDraft,
    });
  }

  return input.draftValue;
}
