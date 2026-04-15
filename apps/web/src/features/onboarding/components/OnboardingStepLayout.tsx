"use client"

import { ArrowLeft } from "@phosphor-icons/react"
import type { PropsWithChildren, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { OttoAvatar } from "@/components/OttoAvatar"
import { cn } from "@/lib/utils"

export interface OnboardingStepLayoutProps extends PropsWithChildren {
  actions?: ReactNode
  footer?: ReactNode
  className?: string
  currentStep: number
  description?: string
  onBack?: () => void
  title: string
  totalSteps: number
}

export function OnboardingStepLayout({
  actions,
  children,
  className,
  currentStep,
  description,
  footer,
  onBack,
  title,
  totalSteps,
}: OnboardingStepLayoutProps) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#faf8f3] px-6 py-14">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40vh] bg-[radial-gradient(circle_at_50%_100%,rgba(120,145,255,0.45)_0%,rgba(173,199,255,0.20)_26%,rgba(249,140,182,0.32)_52%,rgba(250,248,243,0)_78%)]" />
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-6 text-center">
        <div className="flex w-full items-center justify-start">
          {onBack ? (
            <Button
              className="rounded-full px-4 shadow-none"
              onClick={onBack}
              type="button"
              variant="ghost"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <div className="h-9" />
          )}
        </div>
        <OttoAvatar className="size-10 rounded-md" />
        <div className="max-w-4xl space-y-3">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-[3.75rem]">
            {title}
          </h1>
          {description ? (
            <p className="mx-auto max-w-3xl text-balance text-base leading-7 text-muted-foreground md:text-lg">
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

        {footer ? (
          <div className="flex w-full justify-center pt-1">{footer}</div>
        ) : null}
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
        "h-auto min-h-32 w-full flex-col items-center justify-start gap-3 whitespace-normal rounded-xl border border-border/70 bg-background px-5 py-6 text-center text-foreground shadow-none hover:bg-background",
        isSelected &&
          "border-foreground/70 bg-foreground/[0.02] ring-2 ring-foreground/10",
      )}
      onClick={onClick}
      type="button"
      variant="outline"
    >
      <span className="text-balance text-xl font-semibold tracking-tight">
        {label}
      </span>
      {description ? (
        <span className="max-w-full text-balance text-sm leading-6 text-muted-foreground">
          {description}
        </span>
      ) : null}
    </Button>
  )
}
