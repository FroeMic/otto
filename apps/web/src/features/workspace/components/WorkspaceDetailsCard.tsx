import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { useEffect, useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateWorkspaceSettings } from "@/features/workspace/api/workspace"

export interface WorkspaceDetailsCardProps {
  name: string
  orgSlug: string
  slug: string
}

export function WorkspaceDetailsCard({
  name,
  orgSlug,
  slug,
}: WorkspaceDetailsCardProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: "/$orgSlug/settings/workspace" })
  const router = useRouter()
  const nameFieldId = useId()
  const slugFieldId = useId()
  const [nextName, setNextName] = useState(name)
  const [nextSlug, setNextSlug] = useState(slug)
  const mutation = useMutation({
    mutationFn: async (
      input:
        | { action: "update-name"; value: string }
        | { action: "update-slug"; value: string },
    ) => {
      if (input.action === "update-name") {
        return updateWorkspaceSettings(orgSlug, {
          action: "update-name",
          name: input.value,
        })
      }

      return updateWorkspaceSettings(orgSlug, {
        action: "update-slug",
        slug: input.value,
      })
    },
    onSuccess: async (result, variables) => {
      const nextOrgSlug =
        variables.action === "update-slug" && "slug" in result
          ? result.slug
          : orgSlug

      await queryClient.invalidateQueries({
        queryKey: ["shell-bootstrap", orgSlug],
      })
      await router.invalidate()

      if (nextOrgSlug !== orgSlug) {
        await navigate({
          params: { orgSlug: nextOrgSlug },
          replace: true,
          to: "/$orgSlug/settings/workspace",
        })
      }
    },
  })

  useEffect(() => {
    setNextName(name)
  }, [name])

  useEffect(() => {
    setNextSlug(slug)
  }, [slug])

  return (
    <div className="grid gap-4">
      <form
        className="flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate({
            action: "update-name",
            value: nextName,
          })
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={nameFieldId}>
            Workspace name
          </label>
          <p className="text-sm text-muted-foreground">
            Displayed across the workspace shell and member-facing settings.
          </p>
        </div>
        <Input
          id={nameFieldId}
          value={nextName}
          onChange={(event) => setNextName(event.target.value)}
        />
        <div className="flex justify-end">
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Saving…" : "Save name"}
          </Button>
        </div>
      </form>

      <form
        className="flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate({
            action: "update-slug",
            value: nextSlug,
          })
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={slugFieldId}>
            Workspace URL
          </label>
          <p className="text-sm text-muted-foreground">
            This controls the browser-facing workspace route.
          </p>
        </div>
        <Input
          id={slugFieldId}
          value={nextSlug}
          onChange={(event) => setNextSlug(event.target.value)}
        />
        <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          New URL:{" "}
          <span className="font-medium text-foreground">/{nextSlug}</span>
        </div>
        <div className="flex justify-end">
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Saving…" : "Save URL"}
          </Button>
        </div>
      </form>
    </div>
  )
}
