import { useMutation } from "@tanstack/react-query"
import { useEffect, useState } from "react"

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
import { updateUserProfile } from "@/features/workspace/api/workspace"

export interface AccountDetailsCardProps {
  email: string
  firstName: string
  lastName: string
  onSaved: () => Promise<void>
}

export function AccountDetailsCard({
  email,
  firstName,
  lastName,
  onSaved,
}: AccountDetailsCardProps) {
  const [open, setOpen] = useState(false)
  const [nextFirstName, setNextFirstName] = useState(firstName)
  const [nextLastName, setNextLastName] = useState(lastName)
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: async () => {
      await onSaved()
      setOpen(false)
    },
  })

  useEffect(() => {
    setNextFirstName(firstName)
    setNextLastName(lastName)
  }, [firstName, lastName])

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || email

  return (
    <SettingsCard>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Name</SettingsRowTitle>
        </SettingsRowLabel>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{displayName}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(true)
              setError(null)
            }}
          >
            Edit
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit name</DialogTitle>
                <DialogDescription>
                  This name is visible to other members in your workspace.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="firstName" className="text-sm font-medium">
                    First name
                  </label>
                  <Input
                    id="firstName"
                    value={nextFirstName}
                    onChange={(event) => setNextFirstName(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="lastName" className="text-sm font-medium">
                    Last name
                  </label>
                  <Input
                    id="lastName"
                    value={nextLastName}
                    onChange={(event) => setNextLastName(event.target.value)}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
              <DialogFooter>
                <Button
                  disabled={mutation.isPending || nextFirstName.trim().length === 0}
                  onClick={async () => {
                    try {
                      setError(null)
                      await mutation.mutateAsync({
                        firstName: nextFirstName.trim(),
                        lastName: nextLastName.trim(),
                      })
                    } catch (nextError) {
                      setError(
                        nextError instanceof Error
                          ? nextError.message
                          : "Something went wrong",
                      )
                    }
                  }}
                >
                  {mutation.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowLabel>
          <SettingsRowTitle>Email</SettingsRowTitle>
        </SettingsRowLabel>
        <span className="text-sm text-muted-foreground">{email}</span>
      </SettingsRow>
    </SettingsCard>
  )
}
