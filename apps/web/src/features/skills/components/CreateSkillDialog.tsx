import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useId, useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

import {
  createWorkspaceSkill,
  workspaceSkillsQueryOptions,
} from "../api/skills"
import type { WorkspaceInstalledSkillListEntry } from "../types"
import { IntegrationDependencySelect } from "./IntegrationDependencySelect"
import { SkillDependencySelect } from "./SkillDependencySelect"

const DEFAULT_SKILL_BODY = `# New Skill

Describe the workflow the agent should follow.
`

export interface CreateSkillDialogProps {
  knownIntegrationKeys: string[]
  orgSlug: string
  skills: WorkspaceInstalledSkillListEntry[]
}

function toSkillSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
}

export function CreateSkillDialog({
  knownIntegrationKeys,
  orgSlug,
  skills,
}: CreateSkillDialogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [description, setDescription] = useState(
    "Describe when the agent should use this skill.",
  )
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [selectedIntegrationKeys, setSelectedIntegrationKeys] = useState<
    string[]
  >([])
  const [selectedSkillKeys, setSelectedSkillKeys] = useState<string[]>([])
  const [skillBody, setSkillBody] = useState(DEFAULT_SKILL_BODY)
  const [skillKey, setSkillKey] = useState("")
  const skillBodyFieldId = useId()
  const skillDescriptionFieldId = useId()
  const skillKeyFieldId = useId()
  const skillNameFieldId = useId()
  const knownSkillKeys = useMemo(
    () =>
      skills.map((skill) => skill.skillKey).sort((a, b) => a.localeCompare(b)),
    [skills],
  )

  const mutation = useMutation({
    mutationFn: async () =>
      createWorkspaceSkill({
        description,
        integrationKeys: selectedIntegrationKeys,
        name: name.trim() || skillKey.trim(),
        orgSlug,
        skillBody,
        skillKey,
        skillKeys: selectedSkillKeys,
      }),
    onSuccess: async (result) => {
      setIsOpen(false)
      resetForm()
      await queryClient.invalidateQueries({
        queryKey: workspaceSkillsQueryOptions(orgSlug).queryKey,
      })
      void navigate({
        params: {
          orgSlug,
          skillKey: result.skillKey,
        },
        to: "/$orgSlug/skills/$skillKey/overview",
      })
    },
    onError: (error) => {
      toast.error("Skill creation failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  function resetForm() {
    setDescription("Describe when the agent should use this skill.")
    setName("")
    setSelectedIntegrationKeys([])
    setSelectedSkillKeys([])
    setSkillBody(DEFAULT_SKILL_BODY)
    setSkillKey("")
  }

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)

    if (!nextOpen) {
      resetForm()
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} type="button">
        Create skill
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-hidden p-0">
          <div className="flex max-h-[calc(100vh-2rem)] flex-col">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Create skill</DialogTitle>
              <DialogDescription>
                Add a custom skill for this workspace and define the
                instructions the agent should follow.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="flex flex-col gap-6">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={skillKeyFieldId}>Skill key</FieldLabel>
                    <FieldContent>
                      <Input
                        id={skillKeyFieldId}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          setSkillKey(nextValue)

                          if (!name.trim()) {
                            setName(toSkillSlug(nextValue))
                          }
                        }}
                        placeholder="linear-triage"
                        value={skillKey}
                      />
                      <FieldDescription>
                        Stable key used for this skill in the workspace.
                      </FieldDescription>
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor={skillNameFieldId}>Title</FieldLabel>
                    <FieldContent>
                      <Input
                        id={skillNameFieldId}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Linear triage"
                        value={name}
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor={skillDescriptionFieldId}>
                      Description
                    </FieldLabel>
                    <FieldContent>
                      <Textarea
                        className="min-h-24"
                        id={skillDescriptionFieldId}
                        onChange={(event) => setDescription(event.target.value)}
                        value={description}
                      />
                    </FieldContent>
                  </Field>
                </FieldGroup>

                <FieldSet>
                  <FieldLegend>Dependencies</FieldLegend>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field className="gap-2">
                      <FieldLabel>Integrations</FieldLabel>
                      <IntegrationDependencySelect
                        knownIntegrationKeys={knownIntegrationKeys}
                        orgSlug={orgSlug}
                        selectedIntegrationKeys={selectedIntegrationKeys}
                        onSelectedIntegrationKeysChange={
                          setSelectedIntegrationKeys
                        }
                      />
                    </Field>
                    <Field className="gap-2">
                      <FieldLabel>Skills</FieldLabel>
                      {knownSkillKeys.length > 0 ? (
                        <SkillDependencySelect
                          knownSkillKeys={knownSkillKeys}
                          selectedSkillKeys={selectedSkillKeys}
                          skills={skills}
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

                <Field>
                  <FieldLabel htmlFor={skillBodyFieldId}>
                    Instructions
                  </FieldLabel>
                  <FieldContent>
                    <Textarea
                      className="min-h-[22rem] rounded-xl font-mono text-sm leading-6"
                      id={skillBodyFieldId}
                      onChange={(event) => setSkillBody(event.target.value)}
                      value={skillBody}
                    />
                  </FieldContent>
                </Field>
              </div>
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button
                disabled={mutation.isPending}
                onClick={() => setIsOpen(false)}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  mutation.isPending ||
                  !description.trim() ||
                  !skillBody.trim() ||
                  !skillKey.trim()
                }
                onClick={() => mutation.mutate()}
                type="button"
              >
                {mutation.isPending ? "Creating..." : "Create skill"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
