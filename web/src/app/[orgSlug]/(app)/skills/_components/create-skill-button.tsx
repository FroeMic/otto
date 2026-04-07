"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_SKILL_BODY = `# New Skill

Describe the workflow Otto should follow.
`;

export function CreateSkillButton({
  createAction,
  knownIntegrationKeys,
  orgSlug,
}: {
  createAction: (formData: FormData) => Promise<{ skillKey: string }>;
  knownIntegrationKeys: string[];
  orgSlug: string;
}) {
  const router = useRouter();
  const [description, setDescription] = useState(
    "Describe when Otto should use this skill.",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedIntegrationKeys, setSelectedIntegrationKeys] = useState<
    string[]
  >([]);
  const [skillBody, setSkillBody] = useState(DEFAULT_SKILL_BODY);
  const [skillKey, setSkillKey] = useState("");

  function resetForm() {
    setDescription("Describe when Otto should use this skill.");
    setErrorMessage(null);
    setSelectedIntegrationKeys([]);
    setSkillBody(DEFAULT_SKILL_BODY);
    setSkillKey("");
  }

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen);

    if (!nextOpen) {
      resetForm();
    }
  }

  function handleCreate() {
    const formData = new FormData();
    formData.set("description", description);
    formData.set("orgSlug", orgSlug);
    formData.set("skillBody", skillBody);
    formData.set("skillKey", skillKey);

    for (const integrationKey of selectedIntegrationKeys) {
      formData.append("integrationKeys", integrationKey);
    }

    startTransition(async () => {
      setErrorMessage(null);

      try {
        const created = await createAction(formData);
        setIsOpen(false);
        resetForm();
        router.push(
          `/${orgSlug}/skills/${encodeURIComponent(created.skillKey)}`,
        );
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Skill creation failed",
        );
      }
    });
  }

  function handleIntegrationToggle(
    integrationKey: string,
    checked: boolean | "indeterminate",
  ) {
    setSelectedIntegrationKeys((current) => {
      if (checked === true) {
        return [...new Set([...current, integrationKey])].sort((left, right) =>
          left.localeCompare(right),
        );
      }

      return current.filter((entry) => entry !== integrationKey);
    });
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} type="button">
        Create skill
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create skill</DialogTitle>
            <DialogDescription>
              Start with the key skill metadata here. Otto will store it in
              `SKILL.md`, but the frontmatter stays out of the workspace form.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="skill-key">Skill key</FieldLabel>
                <FieldContent>
                  <Input
                    id="skill-key"
                    onChange={(event) => setSkillKey(event.target.value)}
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
                <FieldLabel htmlFor="skill-description">Description</FieldLabel>
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
              <div className="grid gap-3 sm:grid-cols-2">
                {knownIntegrationKeys.map((integrationKey) => {
                  const checked =
                    selectedIntegrationKeys.includes(integrationKey);

                  return (
                    <Field key={integrationKey} orientation="horizontal">
                      <Checkbox
                        checked={checked}
                        id={`skill-dependency-${integrationKey}`}
                        onCheckedChange={(nextChecked) =>
                          handleIntegrationToggle(integrationKey, nextChecked)
                        }
                      />
                      <FieldLabel
                        htmlFor={`skill-dependency-${integrationKey}`}
                      >
                        {integrationKey}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </div>
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="skill-body">Skill instructions</FieldLabel>
              <FieldContent>
                <Textarea
                  className="min-h-[20rem] rounded-xl border-border bg-muted/40 font-mono text-xs leading-5 md:text-xs"
                  id="skill-body"
                  onChange={(event) => setSkillBody(event.target.value)}
                  value={skillBody}
                />
                <FieldDescription>
                  Main markdown body written below the generated metadata
                  header.
                </FieldDescription>
              </FieldContent>
            </Field>
            {errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                isPending ||
                !description.trim() ||
                !skillBody.trim() ||
                !skillKey.trim()
              }
              onClick={handleCreate}
              type="button"
            >
              Create skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
