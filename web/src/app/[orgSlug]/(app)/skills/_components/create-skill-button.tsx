"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_SKILL_TEMPLATE = `---
name: new-skill
description: Describe when Otto should use this skill.
metadata:
  dependsOn:
    integrations: []
---

# New Skill

Describe the workflow Otto should follow.
`;

export function CreateSkillButton({
  createAction,
  orgSlug,
}: {
  createAction: (formData: FormData) => Promise<{ skillKey: string }>;
  orgSlug: string;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [skillContent, setSkillContent] = useState(DEFAULT_SKILL_TEMPLATE);
  const [skillKey, setSkillKey] = useState("");

  function resetForm() {
    setErrorMessage(null);
    setSkillContent(DEFAULT_SKILL_TEMPLATE);
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
    formData.set("orgSlug", orgSlug);
    formData.set("skillContent", skillContent);
    formData.set("skillKey", skillKey);

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
              Start with a `SKILL.md` package entry. You can refine the files in
              the skill detail view after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="skill-key">
                Skill key
              </label>
              <Input
                id="skill-key"
                onChange={(event) => setSkillKey(event.target.value)}
                placeholder="linear-triage"
                value={skillKey}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="skill-content">
                `SKILL.md`
              </label>
              <Textarea
                className="min-h-[24rem] rounded-xl border-border bg-muted/40 font-mono text-xs leading-5 md:text-xs"
                id="skill-content"
                onChange={(event) => setSkillContent(event.target.value)}
                value={skillContent}
              />
            </div>
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
              disabled={isPending || !skillKey.trim() || !skillContent.trim()}
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
