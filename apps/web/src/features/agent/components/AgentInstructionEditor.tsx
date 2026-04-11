import { CaretDownIcon, CaretRightIcon, LockIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { IntegrationFloatingStatusChip } from "@/features/integrations/components/IntegrationFloatingStatusChip"
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"

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
  const [workspaceValue, setWorkspaceValue] = useState(instruction.sharedContent)
  const [savedValue, setSavedValue] = useState(instruction.sharedContent)
  const [version, setVersion] = useState(instruction.version)
  const [isSystemOpen, setIsSystemOpen] = useState(false)
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true)
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false)
  const [isApplyingChanges, setIsApplyingChanges] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const SystemChevronIcon = isSystemOpen ? CaretDownIcon : CaretRightIcon
  const WorkspaceChevronIcon = isWorkspaceOpen
    ? CaretDownIcon
    : CaretRightIcon

  const isDirty = workspaceValue !== savedValue
  const instructionTextareaClassName =
    "min-h-56 rounded-xl border-border bg-muted/40 font-mono text-xs leading-5 md:text-xs"
  const systemTextareaClassName = [
    instructionTextareaClassName,
    "disabled:cursor-default disabled:border-border disabled:bg-muted/20 disabled:opacity-100 disabled:text-foreground",
  ].join(" ")

  useEffect(() => {
    setWorkspaceValue(instruction.sharedContent)
    setSavedValue(instruction.sharedContent)
    setVersion(instruction.version)
    setIsSystemOpen(false)
    setIsWorkspaceOpen(true)
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
              queryKey: agentPersonalizationOverviewQueryOptions(orgSlug).queryKey,
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

      <div className="flex flex-col gap-8">
        <Collapsible
          className="flex flex-col gap-3"
          open={isSystemOpen}
          onOpenChange={setIsSystemOpen}
        >
          <CollapsibleTrigger className="flex items-center gap-2 text-left">
            <SystemChevronIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">System Instructions</span>
            <LockIcon className="size-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <Textarea
              className={systemTextareaClassName}
              defaultValue={instruction.systemContent}
              disabled
              readOnly
            />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible
          className="flex flex-col gap-3"
          open={isWorkspaceOpen}
          onOpenChange={setIsWorkspaceOpen}
        >
          <CollapsibleTrigger className="flex items-center gap-2 text-left">
            <WorkspaceChevronIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Workspace Instructions</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <form
              ref={formRef}
              className="flex flex-col gap-3"
              onSubmit={handleSubmit}
            >
              <Textarea
                className={instructionTextareaClassName}
                name="sharedContent"
                onChange={(event) => setWorkspaceValue(event.target.value)}
                required
                value={workspaceValue}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  disabled={!isDirty || isPending}
                  onClick={handleReset}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button disabled={!isDirty || isPending} type="submit">
                  Save changes
                </Button>
              </div>
            </form>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved workspace instruction changes. Leave this page and
              discard them?
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
