import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useId, useState, useTransition } from "react"
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  createPlatformOrganization,
  platformOrganizationsQueryOptions,
} from "@/features/platform/api/platform"
import { PlatformOrganizationsTable } from "@/features/platform/components/PlatformOrganizationsTable"

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function PlatformOrganizationsPage() {
  const { data } = useSuspenseQuery(platformOrganizationsQueryOptions())
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [isPending, startTransition] = useTransition()
  const nameFieldId = useId()
  const slugFieldId = useId()

  function handleNameChange(value: string) {
    setName(value)

    if (slug.length === 0) {
      setSlug(normalizeSlug(value))
    }
  }

  function handleCreateOrganization() {
    startTransition(async () => {
      try {
        const result = await createPlatformOrganization({
          name,
          slug: slug || undefined,
        })

        toast.success("Created organization.", {
          description: `${result.organization.name} is ready for platform provisioning tests.`,
        })
        setName("")
        setSlug("")
        setIsDialogOpen(false)
        await queryClient.invalidateQueries({
          queryKey: platformOrganizationsQueryOptions().queryKey,
        })
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Organization could not be created.",
        )
      }
    })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 pt-6">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
            <DialogDescription>
              Create an empty platform organization for testing provisioning
              flows. No tenant server or workspace setup will be created yet.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={nameFieldId}>Name</FieldLabel>
              <Input
                autoComplete="off"
                id={nameFieldId}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Snapshot Test"
                value={name}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={slugFieldId}>Slug</FieldLabel>
              <Input
                autoComplete="off"
                id={slugFieldId}
                onChange={(event) => setSlug(normalizeSlug(event.target.value))}
                placeholder="snapshot-test"
                value={slug}
              />
              <FieldDescription>
                This becomes the workspace URL path and must be unique.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter showCloseButton>
            <Button
              disabled={
                isPending || name.trim().length === 0 || slug.length === 0
              }
              onClick={handleCreateOrganization}
              type="button"
            >
              {isPending ? "Creating..." : "Create organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col gap-4 px-4 md:flex-row md:items-start md:justify-between md:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Organizations
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage workspace organizations and create empty test organizations
            for provisioning checks.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} type="button">
          Create organization
        </Button>
      </div>
      <PlatformOrganizationsTable organizations={data.organizations} />
    </div>
  )
}
