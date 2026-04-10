import { PencilSimpleIcon } from "@phosphor-icons/react/ssr"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
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
import { Input } from "@/components/ui/input"
import {
  SettingsCard,
  SettingsRow,
  SettingsRowLabel,
  SettingsRowTitle,
} from "@/client/app/app-shell/SettingsLayout"
import { updateWorkspaceSettings } from "@/features/workspace/api/workspace"

export interface WorkspaceDetailsCardProps {
  name: string
  orgSlug: string
  slug: string
}

interface WorkspaceNameRowProps {
  initialName: string
  orgSlug: string
}

interface WorkspaceSlugRowProps {
  initialSlug: string
  orgSlug: string
}

export function WorkspaceDetailsCard({
  name,
  orgSlug,
  slug,
}: WorkspaceDetailsCardProps) {
  return (
    <SettingsCard>
      <WorkspaceNameRow initialName={name} orgSlug={orgSlug} />
      <WorkspaceSlugRow initialSlug={slug} orgSlug={orgSlug} />
    </SettingsCard>
  )
}

function WorkspaceNameRow({
  initialName,
  orgSlug,
}: WorkspaceNameRowProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(initialName)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(initialName)
  const mutation = useMutation({
    mutationFn: async (nextName: string) => {
      return updateWorkspaceSettings(orgSlug, {
        action: "update-name",
        name: nextName,
      })
    },
    onSuccess: async (result, nextName) => {
      if (!("name" in result)) {
        return
      }

      lastSavedRef.current = nextName
      await queryClient.invalidateQueries({
        queryKey: ["shell-bootstrap", orgSlug],
      })
      toast.success("Workspace name updated")
    },
  })

  useEffect(() => {
    setName(initialName)
    lastSavedRef.current = initialName
  }, [initialName])

  const saveName = useCallback(
    async (value: string) => {
      const trimmed = value.trim()

      if (!trimmed || trimmed === lastSavedRef.current) {
        return
      }

      try {
        await mutation.mutateAsync(trimmed)
      } catch {
        // Keep the field editable and let the user retry.
      }
    },
    [mutation],
  )

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      void saveName(name)
    }, 800)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [name, saveName])

  return (
    <SettingsRow>
      <SettingsRowLabel>
        <SettingsRowTitle>Name</SettingsRowTitle>
      </SettingsRowLabel>
      <Input
        className="w-56 shrink-0"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
    </SettingsRow>
  )
}

function WorkspaceSlugRow({
  initialSlug,
  orgSlug,
}: WorkspaceSlugRowProps) {
  const navigate = useNavigate({ from: "/$orgSlug/settings/workspace" })
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [slug, setSlug] = useState(initialSlug)
  const mutation = useMutation({
    mutationFn: async (nextSlug: string) => {
      return updateWorkspaceSettings(orgSlug, {
        action: "update-slug",
        slug: nextSlug,
      })
    },
    onSuccess: async (result) => {
      if (!("slug" in result)) {
        return
      }

      await router.invalidate()
      await navigate({
        params: { orgSlug: result.slug },
        replace: true,
        to: "/$orgSlug/settings/workspace",
      })
    },
  })

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (nextOpen) {
      setError(null)
      setSlug(initialSlug)
    }
  }

  async function handleUpdate() {
    const normalizedSlug = slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

    if (!normalizedSlug) {
      setError("URL is required")
      return
    }

    if (normalizedSlug === initialSlug) {
      setOpen(false)
      return
    }

    try {
      setError(null)
      await mutation.mutateAsync(normalizedSlug)
      setOpen(false)
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Something went wrong",
      )
    }
  }

  return (
    <SettingsRow>
      <SettingsRowLabel>
        <SettingsRowTitle>URL</SettingsRowTitle>
      </SettingsRowLabel>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">
          getyourotto.com/{initialSlug}
        </span>
        <button
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          type="button"
          onClick={() => handleOpenChange(true)}
        >
          <PencilSimpleIcon className="size-4" />
        </button>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Change workspace URL</DialogTitle>
              <DialogDescription>
                This will change all your URLs. Existing links will stop
                working.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="workspace-slug">
                Enter the new workspace URL
              </label>
              <div className="flex items-center">
                <span className="flex h-9 shrink-0 items-center pr-1 text-sm text-muted-foreground">
                  getyourotto.com/
                </span>
                <Input
                  autoFocus
                  id="workspace-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button
                disabled={mutation.isPending}
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={mutation.isPending || slug.trim().length === 0}
                onClick={() => {
                  void handleUpdate()
                }}
              >
                {mutation.isPending ? "Updating…" : "Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsRow>
  )
}
