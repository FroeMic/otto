import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  buildManagedSkillMarkdown,
  MANAGED_SKILL_ENTRY_FILE_PATH,
  parseManagedSkillMarkdown,
} from "@otto/feature-runtime-core"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
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
import { IntegrationDependencySelect } from "./IntegrationDependencySelect"
import { SkillDependencySelect } from "./SkillDependencySelect"

export interface SkillEditorCardProps {
  detail: WorkspaceSkillDetail
  knownIntegrationKeys: string[]
  knownSkillKeys: string[]
  orgSlug: string
}

export function SkillEditorCard({
  detail,
  knownIntegrationKeys,
  knownSkillKeys,
  orgSlug,
}: SkillEditorCardProps) {
  const queryClient = useQueryClient()
  const { data: skillsData } = useSuspenseQuery(
    workspaceSkillsQueryOptions(orgSlug),
  )
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

      {!skillEntryFile ? (
        <Alert variant="destructive">
          <AlertTitle>Instructions file missing</AlertTitle>
          <AlertDescription>
            This skill does not currently have a readable instructions file.
          </AlertDescription>
        </Alert>
      ) : parsedSkillDocument === null ? (
        <Alert variant="destructive">
          <AlertTitle>Instructions could not be parsed</AlertTitle>
          <AlertDescription>
            Use the files page to inspect the raw file directly.
          </AlertDescription>
        </Alert>
      ) : (
        <>
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
              </FieldContent>
            </Field>

            <FieldSet>
              <FieldLegend>Dependencies</FieldLegend>
              <div className="grid gap-4 md:grid-cols-2">
                <Field className="gap-2">
                  <FieldLabel>Integrations</FieldLabel>
                  <IntegrationDependencySelect
                    disabled={!detail.editable || isPending}
                    knownIntegrationKeys={knownIntegrationKeys}
                    orgSlug={orgSlug}
                    selectedIntegrationKeys={selectedIntegrationKeys}
                    onSelectedIntegrationKeysChange={setSelectedIntegrationKeys}
                  />
                </Field>
                <Field className="gap-2">
                  <FieldLabel>Skills</FieldLabel>
                  {knownSkillKeys.length > 0 ? (
                    <SkillDependencySelect
                      disabled={!detail.editable || isPending}
                      knownSkillKeys={knownSkillKeys}
                      selectedSkillKeys={selectedSkillKeys}
                      skills={skillsData.installedSkills.filter(
                        (skill) => skill.skillKey !== detail.skillKey,
                      )}
                      onSelectedSkillKeysChange={setSelectedSkillKeys}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No other skills exist in this workspace yet.
                    </p>
                  )}
                </Field>
              </div>
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
              Reset draft
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
