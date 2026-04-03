"use client";

import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  LockPasswordIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";

type ManagedInstructionsEditorProps = {
  expectedVersion: number;
  filePath: string;
  instructionTabSlug: string;
  orgSlug: string;
  sharedContent: string;
  systemContent: string;
  updateAction: (formData: FormData) => Promise<void>;
};

export function ManagedInstructionsEditor({
  expectedVersion,
  filePath,
  instructionTabSlug,
  orgSlug,
  sharedContent,
  systemContent,
  updateAction,
}: ManagedInstructionsEditorProps) {
  const router = useRouter();
  const [workspaceValue, setWorkspaceValue] = useState(sharedContent);
  const [savedValue, setSavedValue] = useState(sharedContent);
  const [isSystemOpen, setIsSystemOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const isDirty = workspaceValue !== savedValue;
  const instructionTextareaClassName =
    "min-h-56 rounded-xl border-border bg-muted/40 font-mono text-xs leading-5 md:text-xs";
  const systemTextareaClassName = [
    instructionTextareaClassName,
    "disabled:cursor-default disabled:opacity-100 disabled:border-border disabled:bg-muted/20 disabled:text-foreground",
  ].join(" ");

  useEffect(() => {
    setWorkspaceValue(sharedContent);
    setSavedValue(sharedContent);
    setIsSystemOpen(false);
    setIsWorkspaceOpen(true);
    setIsLeaveDialogOpen(false);
    setPendingHref(null);
  }, [filePath, sharedContent]);

  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!isDirty || event.defaultPrevented) {
        return;
      }

      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      const href = anchor.href;

      if (!href || href === window.location.href) {
        return;
      }

      event.preventDefault();
      setPendingHref(href);
      setIsLeaveDialogOpen(true);
    };

    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);

  function handleReset() {
    setWorkspaceValue(savedValue);
    formRef.current?.reset();
  }

  function handleConfirmLeave() {
    if (!pendingHref) {
      setIsLeaveDialogOpen(false);
      return;
    }

    const targetUrl = new URL(pendingHref, window.location.href);
    const relativeHref = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;

    setIsLeaveDialogOpen(false);
    setPendingHref(null);
    router.push(relativeHref);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      await updateAction(formData);
      setSavedValue(workspaceValue);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-col gap-8">
        <Collapsible
          className="flex flex-col gap-3"
          open={isSystemOpen}
          onOpenChange={setIsSystemOpen}
        >
          <CollapsibleTrigger className="flex items-center gap-2 text-left">
            <HugeiconsIcon
              className="size-4 text-muted-foreground"
              icon={isSystemOpen ? ArrowDown01Icon : ArrowRight01Icon}
              strokeWidth={2}
            />
            <span className="text-sm font-medium">System Instructions</span>
            <HugeiconsIcon
              className="size-4 text-muted-foreground"
              icon={LockPasswordIcon}
              strokeWidth={2}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <Textarea
              className={systemTextareaClassName}
              defaultValue={systemContent}
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
            <HugeiconsIcon
              className="size-4 text-muted-foreground"
              icon={isWorkspaceOpen ? ArrowDown01Icon : ArrowRight01Icon}
              strokeWidth={2}
            />
            <span className="text-sm font-medium">Workspace Instructions</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <form
              ref={formRef}
              className="flex flex-col gap-3"
              onSubmit={handleSubmit}
            >
              <input
                type="hidden"
                name="expectedVersion"
                value={expectedVersion}
              />
              <input type="hidden" name="filePath" value={filePath} />
              <input
                type="hidden"
                name="instructionTabSlug"
                value={instructionTabSlug}
              />
              <input type="hidden" name="orgSlug" value={orgSlug} />
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
  );
}
