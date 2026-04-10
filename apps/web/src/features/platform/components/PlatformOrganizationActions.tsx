import { DotsThreeIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import {
  applyPlatformOrganization,
  deployPlatformRuntime,
  grantPlatformCredits,
  platformOrganizationDetailQueryOptions,
  platformOrganizationsQueryOptions,
  provisionPlatformOpenAiKey,
  refreshPlatformRuntimeImage,
} from "@/features/platform/api/platform"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { PlatformSyncNotification } from "./PlatformSyncNotification"

export interface PlatformOrganizationActionsProps {
  hasTenant: boolean
  hasTenantOpenAiProvider: boolean
  orgSlug: string
  runtimeReady: boolean
}

type OrganizationAction =
  | "apply"
  | "deploy-runtime"
  | "provision-openai-key"
  | "refresh-image"

const ACTION_LABELS: Record<OrganizationAction, string> = {
  apply: "Applying Config",
  "deploy-runtime": "Pulling Image and Applying Config",
  "provision-openai-key": "Provisioning OpenAI API Key",
  "refresh-image": "Pulling and Restarting Image",
}

export function PlatformOrganizationActions({
  hasTenant,
  hasTenantOpenAiProvider,
  orgSlug,
  runtimeReady,
}: PlatformOrganizationActionsProps) {
  const queryClient = useQueryClient()
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false)
  const [grantCreditsValue, setGrantCreditsValue] = useState("100000")
  const [grantNote, setGrantNote] = useState("")
  const [isPending, setIsPending] = useState(false)
  const [syncJobId, setSyncJobId] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState("")

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: platformOrganizationDetailQueryOptions(orgSlug).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: platformOrganizationsQueryOptions().queryKey,
      }),
    ])
  }

  async function runAction(action: OrganizationAction) {
    setIsPending(true)

    try {
      const result =
        action === "apply"
          ? await applyPlatformOrganization(orgSlug)
          : action === "deploy-runtime"
            ? await deployPlatformRuntime(orgSlug)
            : action === "provision-openai-key"
              ? await provisionPlatformOpenAiKey(orgSlug)
              : await refreshPlatformRuntimeImage(orgSlug)

      setSyncJobId(result.jobId)
      setSyncMessage(
        action === "provision-openai-key" && hasTenantOpenAiProvider
          ? "Rotating OpenAI API Key"
          : ACTION_LABELS[action],
      )

      toast.success(
        action === "apply"
          ? "Queued runtime apply."
          : action === "deploy-runtime"
            ? "Queued runtime deploy."
            : action === "provision-openai-key"
              ? hasTenantOpenAiProvider
                ? "Queued OpenAI key rotation."
                : "Queued OpenAI key provisioning."
              : "Queued runtime image refresh.",
      )

      await invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Platform action failed.",
      )
    } finally {
      setIsPending(false)
    }
  }

  async function handleGrantCredits() {
    const credits = Number(grantCreditsValue)

    if (!Number.isFinite(credits) || credits <= 0) {
      toast.error("Enter a positive credit amount.")
      return
    }

    if (grantNote.trim().length === 0) {
      toast.error("Add a reason for the manual grant.")
      return
    }

    setIsPending(true)

    try {
      const result = await grantPlatformCredits({
        orgSlug,
        payload: {
          credits,
          note: grantNote,
        },
      })
      toast.success(
        `Granted ${new Intl.NumberFormat().format(
          result.grantedCreditsMilli / 1_000,
        )} credits.`,
        {
          description: `Workspace balance is now ${new Intl.NumberFormat().format(
            result.balanceCreditsMilli / 1_000,
          )} credits.`,
        },
      )
      setGrantNote("")
      setIsGrantDialogOpen(false)
      await invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Credit grant failed.",
      )
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
      {syncJobId ? (
        <PlatformSyncNotification
          jobId={syncJobId}
          message={syncMessage}
          onDone={() => {
            setSyncJobId(null)
            setSyncMessage("")
          }}
          orgSlug={orgSlug}
        />
      ) : null}
      <Dialog open={isGrantDialogOpen} onOpenChange={setIsGrantDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Grant credits</DialogTitle>
            <DialogDescription>
              Add spendable credits directly to this workspace before Stripe
              grants are wired up.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="platform-grant-credits">
                Credit amount
              </FieldLabel>
              <Input
                id="platform-grant-credits"
                inputMode="decimal"
                min="0"
                onChange={(event) => setGrantCreditsValue(event.target.value)}
                step="0.001"
                value={grantCreditsValue}
              />
              <FieldDescription>
                Current funding and proxy enforcement use Otto credits directly.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-grant-note">Reason</FieldLabel>
              <Textarea
                id="platform-grant-note"
                onChange={(event) => setGrantNote(event.target.value)}
                placeholder="Initial funding for launch tenant, test balance top-up, customer support adjustment..."
                rows={4}
                value={grantNote}
              />
            </Field>
          </FieldGroup>
          <DialogFooter showCloseButton>
            <Button
              disabled={
                isPending ||
                !Number.isFinite(Number(grantCreditsValue)) ||
                Number(grantCreditsValue) <= 0 ||
                grantNote.trim().length === 0
              }
              onClick={handleGrantCredits}
            >
              {isPending ? "Granting…" : "Grant credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Open organization actions"
              disabled={isPending || syncJobId !== null}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <DotsThreeIcon weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          <DropdownMenuItem
            className="whitespace-nowrap"
            disabled={!hasTenant || isPending || syncJobId !== null}
            onClick={() => setIsGrantDialogOpen(true)}
          >
            Grant credits
          </DropdownMenuItem>
          <DropdownMenuItem
            className="whitespace-nowrap"
            disabled={!hasTenant || !runtimeReady || isPending || syncJobId !== null}
            onClick={() => runAction("deploy-runtime")}
          >
            Pull new image and apply config
          </DropdownMenuItem>
          <DropdownMenuItem
            className="whitespace-nowrap"
            disabled={!hasTenant || !runtimeReady || isPending || syncJobId !== null}
            onClick={() => runAction("apply")}
          >
            Apply tenant config
          </DropdownMenuItem>
          <DropdownMenuItem
            className="whitespace-nowrap"
            disabled={!hasTenant || isPending || syncJobId !== null}
            onClick={() => runAction("provision-openai-key")}
          >
            {hasTenantOpenAiProvider
              ? "Rotate OpenAI API key"
              : "Provision OpenAI API key"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="whitespace-nowrap"
            disabled={!hasTenant || !runtimeReady || isPending || syncJobId !== null}
            onClick={() => runAction("refresh-image")}
          >
            Pull and restart image
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
