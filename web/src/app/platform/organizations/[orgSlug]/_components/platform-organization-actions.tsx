"use client";

import { DotsThree } from "@phosphor-icons/react/ssr";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { SyncNotification } from "@/components/sync-notification";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PlatformOrganizationActionsProps = {
  hasTenant: boolean;
  hasTenantOpenAiProvider: boolean;
  orgSlug: string;
  runtimeReady: boolean;
};

type OrganizationAction = "apply" | "provision-openai-key" | "refresh-image";

const ACTION_LABELS: Record<OrganizationAction, string> = {
  apply: "Applying Config",
  "provision-openai-key": "Provisioning OpenAI API Key",
  "refresh-image": "Pulling and Restarting Image",
};

export function PlatformOrganizationActions({
  hasTenant,
  hasTenantOpenAiProvider,
  orgSlug,
  runtimeReady,
}: PlatformOrganizationActionsProps) {
  const router = useRouter();
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false);
  const [grantCredits, setGrantCredits] = useState("100000");
  const [grantNote, setGrantNote] = useState("");
  const [isGrantPending, setIsGrantPending] = useState(false);

  const grantCreditsValue = useMemo(() => Number(grantCredits), [grantCredits]);

  const runAction = async (action: OrganizationAction) => {
    const endpoint =
      action === "apply"
        ? `/api/platform/organizations/${orgSlug}/apply`
        : action === "provision-openai-key"
          ? `/api/platform/organizations/${orgSlug}/provision-openai-key`
          : `/api/platform/organizations/${orgSlug}/refresh-image`;

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        jobId?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.message ??
            `Platform action failed with status ${response.status}.`,
        );
      }

      if (body?.jobId) {
        setSyncMessage(
          action === "provision-openai-key" && hasTenantOpenAiProvider
            ? "Rotating OpenAI API Key"
            : ACTION_LABELS[action],
        );
        setSyncJobId(body.jobId);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Platform action failed.",
      );
    }
  };

  const handleDone = useCallback(() => {
    setSyncJobId(null);
    setSyncMessage("");
  }, []);

  const handleGrantCredits = async () => {
    const credits = Number(grantCredits);
    const note = grantNote.trim();

    if (!Number.isFinite(credits) || credits <= 0) {
      toast.error("Enter a positive credit amount.");
      return;
    }

    if (note.length === 0) {
      toast.error("Add a reason for the manual grant.");
      return;
    }

    setIsGrantPending(true);

    try {
      const response = await fetch(
        `/api/platform/organizations/${orgSlug}/grant-credits`,
        {
          body: JSON.stringify({
            credits,
            note,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const body = (await response.json().catch(() => null)) as {
        balanceCreditsMilli?: number;
        grantedCreditsMilli?: number;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body?.message ??
            `Credit grant failed with status ${response.status}.`,
        );
      }

      const grantedCredits = (body?.grantedCreditsMilli ?? 0) / 1_000;
      const balanceCredits = (body?.balanceCreditsMilli ?? 0) / 1_000;

      toast.success(
        `Granted ${new Intl.NumberFormat().format(grantedCredits)} credits.`,
        {
          description: `Workspace balance is now ${new Intl.NumberFormat().format(
            balanceCredits,
          )} credits.`,
        },
      );
      setGrantNote("");
      setIsGrantDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Credit grant failed.",
      );
    } finally {
      setIsGrantPending(false);
    }
  };

  return (
    <>
      {syncJobId ? (
        <SyncNotification
          jobId={syncJobId}
          message={syncMessage}
          onDone={handleDone}
          orgSlug={orgSlug}
          statusUrl={`/api/platform/organizations/${orgSlug}/jobs/${syncJobId}/status`}
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
                onChange={(event) => setGrantCredits(event.target.value)}
                step="0.001"
                value={grantCredits}
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
                isGrantPending ||
                !Number.isFinite(grantCreditsValue) ||
                grantCreditsValue <= 0 ||
                grantNote.trim().length === 0
              }
              onClick={handleGrantCredits}
            >
              {isGrantPending ? "Granting…" : "Grant credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Open organization actions"
              size="icon-sm"
              variant="ghost"
              disabled={syncJobId !== null}
            />
          }
        >
          <DotsThree weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          <DropdownMenuItem
            className="whitespace-nowrap"
            disabled={!hasTenant || syncJobId !== null || isGrantPending}
            onSelect={() => setIsGrantDialogOpen(true)}
          >
            Grant credits
          </DropdownMenuItem>
          <DropdownMenuItem
            className="whitespace-nowrap"
            disabled={!hasTenant || !runtimeReady || syncJobId !== null}
            onClick={() => runAction("apply")}
          >
            Apply tenant config
          </DropdownMenuItem>
          <DropdownMenuItem
            className="whitespace-nowrap"
            disabled={!hasTenant || syncJobId !== null}
            onClick={() => runAction("provision-openai-key")}
          >
            {hasTenantOpenAiProvider
              ? "Rotate OpenAI API key"
              : "Provision OpenAI API key"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="whitespace-nowrap"
            disabled={!hasTenant || !runtimeReady || syncJobId !== null}
            onClick={() => runAction("refresh-image")}
          >
            Pull and restart image
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
