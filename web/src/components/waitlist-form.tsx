"use client";

import {
  ArrowRightIcon,
  CheckCircleIcon,
  CircleNotchIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import * as React from "react";
import { useFormStatus } from "react-dom";

import {
  submitWaitlistSignupAction,
  type WaitlistFormState,
} from "@/app/register/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" size="lg" type="submit" disabled={pending}>
      {pending ? (
        <>
          <CircleNotchIcon className="animate-spin" data-icon="inline-start" />
          Submitting
        </>
      ) : (
        <>
          Join the waitlist
          <ArrowRightIcon data-icon="inline-end" />
        </>
      )}
    </Button>
  );
}

function WaitlistForm() {
  const initialState: WaitlistFormState = {
    fieldErrors: {},
    message: null,
    status: "idle",
  };
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const [state, formAction] = React.useActionState(
    submitWaitlistSignupAction,
    initialState,
  );
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = React.useState(false);
  const [usagePreference, setUsagePreference] = React.useState<
    "alone" | "team"
  >("alone");

  React.useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setUsagePreference("alone");
      setIsSuccessDialogOpen(true);
    }
  }, [state.status]);

  const onUsagePreferenceChange = React.useCallback((value: string[]) => {
    const nextPreference = value[0];

    if (nextPreference === "alone" || nextPreference === "team") {
      setUsagePreference(nextPreference);
    }
  }, []);

  return (
    <>
      <form ref={formRef} action={formAction} className="flex flex-col gap-6">
        <FieldGroup>
          <Field data-invalid={Boolean(state.fieldErrors.name?.length)}>
            <FieldLabel htmlFor="waitlist-name">Name</FieldLabel>
            <Input
              aria-invalid={Boolean(state.fieldErrors.name?.length)}
              autoComplete="name"
              id="waitlist-name"
              name="name"
              placeholder="Ada Lovelace"
              required
            />
            <FieldError>{state.fieldErrors.name?.[0]}</FieldError>
          </Field>
          <Field data-invalid={Boolean(state.fieldErrors.email?.length)}>
            <FieldLabel htmlFor="waitlist-email">Email</FieldLabel>
            <Input
              aria-invalid={Boolean(state.fieldErrors.email?.length)}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              id="waitlist-email"
              name="email"
              placeholder="ada@example.com"
              required
              spellCheck={false}
              type="email"
            />
            <FieldError>{state.fieldErrors.email?.[0]}</FieldError>
          </Field>
          <Field
            data-invalid={Boolean(state.fieldErrors.usagePreference?.length)}
          >
            <FieldLabel htmlFor="waitlist-usage-preference">
              I want to use Otto
            </FieldLabel>
            <input
              id="waitlist-usage-preference"
              name="usagePreference"
              type="hidden"
              value={usagePreference}
            />
            <ToggleGroup
              aria-label="Choose whether you want to use Otto alone or with a team"
              onValueChange={onUsagePreferenceChange}
              value={[usagePreference]}
              variant="outline"
            >
              <ToggleGroupItem aria-label="Use Otto alone" value="alone">
                Alone
              </ToggleGroupItem>
              <ToggleGroupItem aria-label="Use Otto with a team" value="team">
                Team
              </ToggleGroupItem>
            </ToggleGroup>
            <FieldError>{state.fieldErrors.usagePreference?.[0]}</FieldError>
          </Field>
          <Field
            data-invalid={Boolean(state.fieldErrors.heardAboutOtto?.length)}
          >
            <FieldLabel htmlFor="waitlist-heard-about">
              Where have you heard about Otto
            </FieldLabel>
            <Textarea
              aria-invalid={Boolean(state.fieldErrors.heardAboutOtto?.length)}
              autoComplete="off"
              id="waitlist-heard-about"
              name="heardAboutOtto"
              placeholder="A friend mentioned it, a post, a demo..."
              rows={3}
            />
            <FieldDescription>Optional.</FieldDescription>
            <FieldError>{state.fieldErrors.heardAboutOtto?.[0]}</FieldError>
          </Field>
          <Field data-invalid={Boolean(state.fieldErrors.useCase?.length)}>
            <FieldLabel htmlFor="waitlist-use-case">
              What do you want to use Otto for
            </FieldLabel>
            <Textarea
              aria-invalid={Boolean(state.fieldErrors.useCase?.length)}
              autoComplete="off"
              id="waitlist-use-case"
              name="useCase"
              placeholder="Inbox triage, support workflows, internal ops..."
              rows={4}
            />
            <FieldDescription>Optional.</FieldDescription>
            <FieldError>{state.fieldErrors.useCase?.[0]}</FieldError>
          </Field>
        </FieldGroup>
        <div className="flex flex-col gap-4">
          <SubmitButton />
          <p
            aria-live="polite"
            className={
              state.status === "error" ? "text-sm text-destructive" : "hidden"
            }
          >
            {state.message}
          </p>
          <p className="text-sm text-muted-foreground">
            Already invited?{" "}
            <Link className="underline underline-offset-4" href="/login">
              Sign in
            </Link>
            .
          </p>
        </div>
      </form>
      <AlertDialog
        open={isSuccessDialogOpen}
        onOpenChange={setIsSuccessDialogOpen}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <CheckCircleIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>You're on the list</AlertDialogTitle>
            <AlertDialogDescription>
              {state.message ??
                "We will reach out when Otto is ready for your setup."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { WaitlistForm };
