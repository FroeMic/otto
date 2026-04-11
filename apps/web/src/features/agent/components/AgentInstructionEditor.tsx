import { LockIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { IntegrationFloatingStatusChip } from "@/features/integrations/components/IntegrationFloatingStatusChip"

import {
  agentPersonalizationDetailQueryOptions,
  agentPersonalizationOverviewQueryOptions,
  updateAgentPersonalizationInstruction,
} from "../api/agent"
import type { AgentInstruction } from "../types"

export interface AgentInstructionEditorProps {
  instruction: AgentInstruction
  orgSlug: string
}

export function AgentInstructionEditor({
  instruction,
  orgSlug,
}: AgentInstructionEditorProps) {
  const queryClient = useQueryClient()
  const [workspaceValue, setWorkspaceValue] = useState(
    instruction.sharedContent,
  )
  const [savedValue, setSavedValue] = useState(instruction.sharedContent)
  const [version, setVersion] = useState(instruction.version)
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false)
  const [isApplyingChanges, setIsApplyingChanges] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const isDirty = workspaceValue !== savedValue
  const instructionTextareaClassName =
    "min-h-64 rounded-2xl border-border bg-muted/40 font-mono text-xs leading-5 md:text-xs"
  const systemTextareaClassName = [
    instructionTextareaClassName,
    "disabled:cursor-default disabled:border-border disabled:bg-muted/20 disabled:opacity-100 disabled:text-foreground",
  ].join(" ")

  useEffect(() => {
    setWorkspaceValue(instruction.sharedContent)
    setSavedValue(instruction.sharedContent)
    setVersion(instruction.version)
    setIsLeaveDialogOpen(false)
    setPendingHref(null)
  }, [instruction])

  useEffect(() => {
    if (!isDirty) {
      return undefined
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isDirty])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!isDirty || event.defaultPrevented) {
        return
      }

      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      const anchor = target.closest("a[href]")

      if (!(anchor instanceof HTMLAnchorElement)) {
        return
      }

      if (anchor.target && anchor.target !== "_self") {
        return
      }

      const href = anchor.href

      if (!href || href === window.location.href) {
        return
      }

      event.preventDefault()
      setPendingHref(href)
      setIsLeaveDialogOpen(true)
    }

    document.addEventListener("click", handleDocumentClick, true)

    return () => {
      document.removeEventListener("click", handleDocumentClick, true)
    }
  }, [isDirty])

  function handleReset() {
    setWorkspaceValue(savedValue)
    formRef.current?.reset()
  }

  function handleConfirmLeave() {
    if (!pendingHref) {
      setIsLeaveDialogOpen(false)
      return
    }

    const targetUrl = new URL(pendingHref, window.location.href)
    const relativeHref = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`

    setIsLeaveDialogOpen(false)
    setPendingHref(null)
    window.location.assign(relativeHref)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    startTransition(() => {
      setIsApplyingChanges(true)

      void updateAgentPersonalizationInstruction({
        expectedVersion: version,
        instructionTab: instruction.slug,
        orgSlug,
        sharedContent: workspaceValue,
      })
        .then(async (result) => {
          setSavedValue(result.instruction.sharedContent)
          setWorkspaceValue(result.instruction.sharedContent)
          setVersion(result.instruction.version)

          await Promise.all([
            queryClient.invalidateQueries({
              queryKey:
                agentPersonalizationOverviewQueryOptions(orgSlug).queryKey,
            }),
            queryClient.invalidateQueries({
              queryKey: agentPersonalizationDetailQueryOptions({
                instructionTab: instruction.slug,
                orgSlug,
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
          toast.error("Agent personalization could not be saved", {
            description:
              error instanceof Error ? error.message : "Unknown error",
          })
        })
    })
  }

  return (
    <>
      {isApplyingChanges ? (
        <IntegrationFloatingStatusChip message="Applying Changes" />
      ) : null}

      <form ref={formRef} onSubmit={handleSubmit}>
        <Card className="gap-0 rounded-3xl py-0 ring-1 ring-border/70">
          <CardHeader className="gap-2 border-b border-border px-6 py-5">
            <CardTitle>Instruction file</CardTitle>
            <CardDescription>
              Otto keeps the system instructions locked and appends your
              workspace guidance below.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 py-6">
            <FieldGroup>
              <Field>
                <FieldContent className="gap-3">
                  <FieldTitle>
                    System instructions
                    <LockIcon className="size-4 text-muted-foreground" />
                  </FieldTitle>
                  <FieldDescription>
                    These instructions are managed by Otto and cannot be edited
                    here.
                  </FieldDescription>
                  <Textarea
                    className={systemTextareaClassName}
                    defaultValue={instruction.systemContent}
                    disabled
                    readOnly
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldContent className="gap-3">
                  <FieldTitle>Workspace instructions</FieldTitle>
                  <FieldDescription>
                    Add workspace-specific guidance Otto should follow for this
                    file.
                  </FieldDescription>
                  <Textarea
                    className={instructionTextareaClassName}
                    name="sharedContent"
                    onChange={(event) => setWorkspaceValue(event.target.value)}
                    required
                    value={workspaceValue}
                  />
                </FieldContent>
              </Field>
            </FieldGroup>
          </CardContent>

          <CardFooter className="justify-end gap-2 border-t border-border px-6 py-4">
            <Button
              disabled={!isDirty || isPending}
              onClick={handleReset}
              type="button"
              variant="outline"
            >
              Reset
            </Button>
            <Button disabled={!isDirty || isPending} type="submit">
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved workspace instruction changes. Leave this page
              and discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay here</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLeave}>
              Leave page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
