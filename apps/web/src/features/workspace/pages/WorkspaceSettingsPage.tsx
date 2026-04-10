import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { useEffect, useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SettingsPage,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionTitle,
} from "@/client/app/app-shell/SettingsLayout"
import {
  shellBootstrapQueryOptions,
  updateWorkspaceSettings,
} from "@/features/workspace/api/workspace"

export interface WorkspaceSettingsPageProps {
  orgSlug: string
}

export function WorkspaceSettingsPage({
  orgSlug,
}: WorkspaceSettingsPageProps) {
  const { data } = useSuspenseQuery(shellBootstrapQueryOptions(orgSlug))
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: "/$orgSlug/settings/workspace" })
  const router = useRouter()
  const nameFieldId = useId()
  const slugFieldId = useId()
  const [name, setName] = useState(data.currentOrganization.name)
  const [slug, setSlug] = useState(data.currentOrganization.slug)
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
    setName(data.currentOrganization.name)
    setSlug(data.currentOrganization.slug)
  }, [data.currentOrganization.name, data.currentOrganization.slug])

  return (
    <SettingsPage>
      <div className="flex flex-col gap-8">
        <SettingsPageTitle>General</SettingsPageTitle>

        <SettingsSection>
          <SettingsSectionTitle>Workspace details</SettingsSectionTitle>
          <form
            className="flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate({
                action: "update-name",
                value: name,
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
              value={name}
              onChange={(event) => setName(event.target.value)}
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
                value: slug,
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
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
            <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              New URL: <span className="font-medium text-foreground">/{slug}</span>
            </div>
            <div className="flex justify-end">
              <Button disabled={mutation.isPending} type="submit">
                {mutation.isPending ? "Saving…" : "Save URL"}
              </Button>
            </div>
          </form>
        </SettingsSection>

        <SettingsSection>
          <SettingsSectionTitle>Time and Region</SettingsSectionTitle>
          <section className="rounded-[1.5rem] border border-border/70 bg-card px-5 py-5 shadow-sm">
            <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
              <div className="rounded-xl bg-muted px-4 py-3">
                Locale:{" "}
                <span className="font-medium text-foreground">
                  {data.currentOrganization.locale}
                </span>
              </div>
              <div className="rounded-xl bg-muted px-4 py-3">
                Timezone:{" "}
                <span className="font-medium text-foreground">
                  {data.currentOrganization.timezone}
                </span>
              </div>
              <div className="rounded-xl bg-muted px-4 py-3">
                Clock:{" "}
                <span className="font-medium text-foreground">
                  {data.currentOrganization.timeFormatPreference}
                </span>
              </div>
            </div>
          </section>
        </SettingsSection>
      </div>
    </SettingsPage>
  )
}
