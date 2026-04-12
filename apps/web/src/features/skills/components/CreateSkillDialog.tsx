import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

import { createWorkspaceSkill, workspaceSkillsQueryOptions } from "../api/skills"
import type { WorkspaceSkillListEntry } from "../types"

const DEFAULT_SKILL_BODY = `# New Skill

Describe the workflow Otto should follow.
`

export interface CreateSkillDialogProps {
  knownIntegrationKeys: string[]
  orgSlug: string
  skills: WorkspaceSkillListEntry[]
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
    "Describe when Otto should use this skill.",
  )
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [selectedIntegrationKeys, setSelectedIntegrationKeys] = useState<
    string[]
  >([])
  const [selectedSkillKeys, setSelectedSkillKeys] = useState<string[]>([])
  const [skillBody, setSkillBody] = useState(DEFAULT_SKILL_BODY)
  const [skillKey, setSkillKey] = useState("")
  const knownSkillKeys = useMemo(
    () => skills.map((skill) => skill.skillKey).sort((a, b) => a.localeCompare(b)),
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
        to: "/$orgSlug/skills/$skillKey/status",
      })
    },
    onError: (error) => {
      toast.error("Skill creation failed", {
        description:
          error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  function resetForm() {
    setDescription("Describe when Otto should use this skill.")
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
                Start with the managed `SKILL.md` metadata here. Runtime-local
                files stay in the skill package on the tenant runtime.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="flex flex-col gap-6">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="skill-key">Skill key</FieldLabel>
                    <FieldContent>
                      <Input
                        id="skill-key"
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
                        Stable slug used for the package path and runtime
                        projection.
                      </FieldDescription>
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="skill-name">Title</FieldLabel>
                    <FieldContent>
                      <Input
                        id="skill-name"
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Linear triage"
                        value={name}
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="skill-description">
                      Description
                    </FieldLabel>
                    <FieldContent>
                      <Textarea
                        className="min-h-24"
                        id="skill-description"
                        onChange={(event) => setDescription(event.target.value)}
                        value={description}
                      />
                      <FieldDescription>
                        Short guidance for when Otto should reach for this skill.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldGroup>

                <FieldSet>
                  <FieldLegend>Integration dependencies</FieldLegend>
                  <FieldDescription>
                    Optional prerequisites Otto should expect before using this
                    skill.
                  </FieldDescription>
                  {knownIntegrationKeys.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {knownIntegrationKeys.map((integrationKey) => (
                        <Field key={integrationKey} orientation="horizontal">
                          <Checkbox
                            checked={selectedIntegrationKeys.includes(
                              integrationKey,
                            )}
                            id={`skill-dependency-${integrationKey}`}
                            onCheckedChange={(nextChecked) =>
                              handleIntegrationToggle(
                                integrationKey,
                                nextChecked,
                              )
                            }
                          />
                          <FieldLabel
                            htmlFor={`skill-dependency-${integrationKey}`}
                          >
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
                            checked={selectedSkillKeys.includes(
                              dependencySkillKey,
                            )}
                            id={`skill-skill-dependency-${dependencySkillKey}`}
                            onCheckedChange={(nextChecked) =>
                              handleSkillToggle(
                                dependencySkillKey,
                                nextChecked,
                              )
                            }
                          />
                          <FieldLabel
                            htmlFor={`skill-skill-dependency-${dependencySkillKey}`}
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
                  )}
                </FieldSet>

                <Field>
                  <FieldLabel htmlFor="skill-body">Instructions</FieldLabel>
                  <FieldContent>
                    <Textarea
                      className="min-h-[22rem] rounded-xl font-mono text-sm leading-6"
                      id="skill-body"
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
