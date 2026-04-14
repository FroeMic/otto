"use client"

import type { PropsWithChildren, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface OnboardingStepLayoutProps extends PropsWithChildren {
  actions?: ReactNode
  className?: string
  currentStep: number
  description?: string
  title: string
  totalSteps: number
}

function OttoMark() {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="size-9 rounded-2xl bg-[linear-gradient(180deg,#ff8a42_0%,#f45f7a_48%,#6f7df4_100%)]" />
    </span>
  )
}

export function OnboardingStepLayout({
  actions,
  children,
  className,
  currentStep,
  description,
  title,
  totalSteps,
}: OnboardingStepLayoutProps) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#faf8f3] px-6 py-16">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40vh] bg-[radial-gradient(circle_at_50%_100%,rgba(120,145,255,0.45)_0%,rgba(173,199,255,0.20)_26%,rgba(249,140,182,0.32)_52%,rgba(250,248,243,0)_78%)]" />
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-8 text-center">
        <OttoMark />
        <div className="max-w-3xl space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
            {title}
          </h1>
          {description ? (
            <p className="text-base leading-8 text-muted-foreground md:text-lg">
              {description}
            </p>
          ) : null}
        </div>

        <div className={cn("w-full max-w-4xl", className)}>{children}</div>

        {actions ? <div className="flex justify-center">{actions}</div> : null}

        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }, (_, index) => (
            <span
              className={cn(
                "size-2 rounded-full bg-foreground/20 transition-colors",
                index + 1 === currentStep && "w-5 bg-foreground",
              )}
              key={index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export interface OnboardingOptionButtonProps {
  description?: string
  isSelected?: boolean
  label: string
  onClick?: () => void
}

export function OnboardingOptionButton({
  description,
  isSelected = false,
  label,
  onClick,
}: OnboardingOptionButtonProps) {
  return (
    <Button
      className={cn(
        "h-auto min-h-32 w-full flex-col items-center justify-center gap-3 rounded-[1.4rem] border border-border/70 bg-background px-6 py-8 text-center text-foreground shadow-none hover:bg-background",
        isSelected &&
          "border-foreground/70 bg-foreground/[0.02] ring-2 ring-foreground/10",
      )}
      onClick={onClick}
      type="button"
      variant="outline"
    >
      <span className="text-xl font-semibold tracking-tight">{label}</span>
      {description ? (
        <span className="max-w-56 text-sm leading-6 text-muted-foreground">
          {description}
        </span>
      ) : null}
    </Button>
  )
}
