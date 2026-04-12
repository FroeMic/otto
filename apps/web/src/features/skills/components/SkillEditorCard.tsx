import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  buildManagedSkillMarkdown,
  MANAGED_SKILL_ENTRY_FILE_PATH,
  parseManagedSkillMarkdown,
} from "@otto/feature-runtime-core"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { IntegrationFloatingStatusChip } from "@/features/integrations/components/IntegrationFloatingStatusChip"

import {
  updateWorkspaceSkill,
  workspaceSkillDetailQueryOptions,
  workspaceSkillsQueryOptions,
} from "../api/skills"
import type { WorkspaceSkillDetail } from "../types"

export interface SkillEditorCardProps {
  detail: WorkspaceSkillDetail
  knownIntegrationKeys: string[]
  knownSkillKeys: string[]
  orgSlug: string
}

const statusBadgeVariant: Record<
  WorkspaceSkillDetail["status"],
  "default" | "destructive" | "outline" | "secondary"
> = {
  disabled: "secondary",
  invalid: "destructive",
  missing_prerequisite: "outline",
  projection_failed: "destructive",
  ready: "default",
}

function formatStatusLabel(status: WorkspaceSkillDetail["status"]) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatSourceLabel(sourceType: WorkspaceSkillDetail["sourceType"]) {
  return sourceType === "integration_contribution"
    ? "Integration starter"
    : sourceType === "system"
      ? "System managed"
      : "Workspace managed"
}

function getStatusDescription(status: WorkspaceSkillDetail["status"]) {
  switch (status) {
    case "ready":
      return "This skill is projected into the runtime and ready for Otto to use."
    case "missing_prerequisite":
      return "This skill depends on an integration or prerequisite that is not currently available."
    case "projection_failed":
      return "The last projection attempt failed. Otto kept the stored package, but the runtime needs attention."
    case "invalid":
      return "The current package does not pass validation and needs to be fixed before Otto can rely on it."
    case "disabled":
      return "This skill is stored for the workspace, but it is not active right now."
  }
}

export function SkillEditorCard({
  detail,
  knownIntegrationKeys,
  knownSkillKeys,
  orgSlug,
}: SkillEditorCardProps) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState(detail.description)
  const [isApplyingChanges, setIsApplyingChanges] = useState(false)
  const [name, setName] = useState(detail.displayName)
  const [selectedIntegrationKeys, setSelectedIntegrationKeys] = useState(
    detail.dependencies.integrations,
  )
  const [selectedSkillKeys, setSelectedSkillKeys] = useState(
    detail.dependencies.skills,
  )
  const [skillBody, setSkillBody] = useState("")
  const [version, setVersion] = useState(detail.version)
  const [isPending, startTransition] = useTransition()
  const skillEntryFile =
    detail.files.find((file) => file.path === MANAGED_SKILL_ENTRY_FILE_PATH) ?? null
  const parsedSkillDocument = useMemo(() => {
    if (
      !skillEntryFile ||
      skillEntryFile.storageEncoding !== "utf8_text" ||
      !skillEntryFile.contentText
    ) {
      return null
    }

    try {
      return parseManagedSkillMarkdown(skillEntryFile.contentText)
    } catch {
      return null
    }
  }, [skillEntryFile])
  const nextContentText = useMemo(() => {
    if (!parsedSkillDocument) {
      return skillEntryFile?.contentText ?? ""
    }

    return buildManagedSkillMarkdown({
      description,
      integrationKeys: selectedIntegrationKeys,
      name,
      skillBody,
      skillKeys: selectedSkillKeys,
    })
  }, [
    description,
    name,
    parsedSkillDocument,
    selectedIntegrationKeys,
    selectedSkillKeys,
    skillBody,
    skillEntryFile?.contentText,
  ])
  const savedContentText = skillEntryFile?.contentText ?? ""
  const isDirty = nextContentText !== savedContentText

  useEffect(() => {
    setDescription(detail.description)
    setName(detail.displayName)
    setSelectedIntegrationKeys(detail.dependencies.integrations)
    setSelectedSkillKeys(detail.dependencies.skills)
    setVersion(detail.version)

    if (parsedSkillDocument) {
      setSkillBody(parsedSkillDocument.skillBody)
    } else {
      setSkillBody("")
    }
  }, [detail, parsedSkillDocument])

  function resetDraft() {
    setDescription(detail.description)
    setName(detail.displayName)
    setSelectedIntegrationKeys(detail.dependencies.integrations)
    setSelectedSkillKeys(detail.dependencies.skills)
    setSkillBody(parsedSkillDocument?.skillBody ?? "")
  }

  function handleIntegrationToggle(
    integrationKey: string,
    checked: boolean | "indeterminate",
  ) {
    setSelectedIntegrationKeys((current) =>
      checked === true
        ? [...new Set([...current, integrationKey])].sort((a, b) =>
            a.localeCompare(b),
          )
        : current.filter((entry) => entry !== integrationKey),
    )
  }

  function handleSkillToggle(
    dependencySkillKey: string,
    checked: boolean | "indeterminate",
  ) {
    setSelectedSkillKeys((current) =>
      checked === true
        ? [...new Set([...current, dependencySkillKey])].sort((a, b) =>
            a.localeCompare(b),
          )
        : current.filter((entry) => entry !== dependencySkillKey),
    )
  }

  function handleSave() {
    if (!detail.editable || !parsedSkillDocument) {
      return
    }

    startTransition(() => {
      setIsApplyingChanges(true)

      void updateWorkspaceSkill({
        description,
        expectedVersion: version,
        integrationKeys: selectedIntegrationKeys,
        name,
        orgSlug,
        skillBody,
        skillKey: detail.skillKey,
        skillKeys: selectedSkillKeys,
      })
        .then(async (result) => {
          setVersion(result.currentVersion ?? version)
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: workspaceSkillsQueryOptions(orgSlug).queryKey,
            }),
            queryClient.invalidateQueries({
              queryKey: workspaceSkillDetailQueryOptions({
                orgSlug,
                skillKey: detail.skillKey,
              }).queryKey,
            }),
          ])

          if (result.applyQueued) {
            window.setTimeout(() => {
              setIsApplyingChanges(false)
            }, 10_000)
          } else {
            setIsApplyingChanges(false)
          }
        })
        .catch((error) => {
          setIsApplyingChanges(false)
          toast.error("Skill could not be saved", {
            description:
              error instanceof Error ? error.message : "Unknown error",
          })
        })
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {isApplyingChanges ? (
        <IntegrationFloatingStatusChip message="Applying Changes" />
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {detail.displayName}
          </h1>
          <Badge variant={statusBadgeVariant[detail.status]}>
            {formatStatusLabel(detail.status)}
          </Badge>
          <Badge variant="secondary">{formatSourceLabel(detail.sourceType)}</Badge>
        </div>
        <p className="max-w-4xl text-sm text-muted-foreground">
          {detail.description}
        </p>
      </div>

      <Alert>
        <AlertTitle>Current status</AlertTitle>
        <AlertDescription>{getStatusDescription(detail.status)}</AlertDescription>
      </Alert>

      {!skillEntryFile ? (
        <Alert variant="destructive">
          <AlertTitle>SKILL.md missing</AlertTitle>
          <AlertDescription>
            This managed skill does not currently have a readable `SKILL.md`
            file to edit.
          </AlertDescription>
        </Alert>
      ) : parsedSkillDocument === null ? (
        <Alert variant="destructive">
          <AlertTitle>SKILL.md could not be parsed</AlertTitle>
          <AlertDescription>
            The status view can only show the structured editor for valid
            managed skill metadata. Use the files tab to inspect the raw file.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {!detail.editable ? (
            <Alert>
              <AlertTitle>Read-only skill</AlertTitle>
              <AlertDescription>
                System-managed skills can be inspected here, but only
                workspace-managed skills can be edited.
              </AlertDescription>
            </Alert>
          ) : null}

          <FieldGroup className="gap-6">
            <Field className="gap-3">
              <FieldLabel htmlFor="skill-name">Title</FieldLabel>
              <FieldContent>
                <Input
                  disabled={!detail.editable || isPending}
                  id="skill-name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </FieldContent>
            </Field>

            <Field className="gap-3">
              <FieldLabel htmlFor="skill-description">Description</FieldLabel>
              <FieldContent>
                <Textarea
                  className="min-h-24"
                  disabled={!detail.editable || isPending}
                  id="skill-description"
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
                <FieldDescription>
                  Short guidance for when Otto should use this skill.
                </FieldDescription>
              </FieldContent>
            </Field>

            <FieldSet>
              <FieldLegend>Integration dependencies</FieldLegend>
              <FieldDescription>
                Optional integrations Otto should expect before using this skill.
              </FieldDescription>
              {knownIntegrationKeys.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {knownIntegrationKeys.map((integrationKey) => (
                    <Field key={integrationKey} orientation="horizontal">
                      <Checkbox
                        checked={selectedIntegrationKeys.includes(integrationKey)}
                        disabled={!detail.editable || isPending}
                        id={`skill-integration-${integrationKey}`}
                        onCheckedChange={(nextChecked) =>
                          handleIntegrationToggle(integrationKey, nextChecked)
                        }
                      />
                      <FieldLabel htmlFor={`skill-integration-${integrationKey}`}>
                        {integrationKey}
                      </FieldLabel>
                    </Field>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No integration definitions are available yet.
                </p>
              )}
            </FieldSet>

            <FieldSet>
              <FieldLegend>Skill dependencies</FieldLegend>
              <FieldDescription>
                Other managed skills this skill expects to exist first.
              </FieldDescription>
              {knownSkillKeys.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {knownSkillKeys.map((dependencySkillKey) => (
                    <Field key={dependencySkillKey} orientation="horizontal">
                      <Checkbox
                        checked={selectedSkillKeys.includes(dependencySkillKey)}
                        disabled={!detail.editable || isPending}
                        id={`skill-dependency-${dependencySkillKey}`}
                        onCheckedChange={(nextChecked) =>
                          handleSkillToggle(dependencySkillKey, nextChecked)
                        }
                      />
                      <FieldLabel htmlFor={`skill-dependency-${dependencySkillKey}`}>
                        {dependencySkillKey}
                      </FieldLabel>
                    </Field>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No other managed skills exist in this workspace yet.
                </p>
              )}
            </FieldSet>

            <Field className="gap-3">
              <FieldLabel htmlFor="skill-body">Instructions</FieldLabel>
              <FieldContent>
                <Textarea
                  className="min-h-[30rem] rounded-xl font-mono text-sm leading-6"
                  disabled={!detail.editable || isPending}
                  id="skill-body"
                  onChange={(event) => setSkillBody(event.target.value)}
                  value={skillBody}
                />
              </FieldContent>
            </Field>
          </FieldGroup>

          <div className="flex items-center justify-end gap-2">
            <Button
              disabled={!isDirty || !detail.editable || isPending}
              onClick={resetDraft}
              type="button"
              variant="outline"
            >
              Reset
            </Button>
            <Button
              disabled={!isDirty || !detail.editable || isPending}
              onClick={handleSave}
              type="button"
            >
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
