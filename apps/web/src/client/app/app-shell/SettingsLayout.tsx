import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

export interface SettingsPageProps extends ComponentProps<"div"> {}

export function SettingsPage({ className, ...props }: SettingsPageProps) {
  return (
    <div
      data-slot="settings-page"
      className={cn("mx-auto w-full max-w-2xl", className)}
      {...props}
    />
  )
}

export interface SettingsPageTitleProps extends ComponentProps<"h1"> {}

export function SettingsPageTitle({
  className,
  ...props
}: SettingsPageTitleProps) {
  return (
    <h1
      data-slot="settings-page-title"
      className={cn("text-2xl font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

export interface SettingsSectionProps extends ComponentProps<"section"> {}

export function SettingsSection({
  className,
  ...props
}: SettingsSectionProps) {
  return (
    <section
      data-slot="settings-section"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  )
}

export interface SettingsSectionTitleProps extends ComponentProps<"h2"> {}

export function SettingsSectionTitle({
  className,
  ...props
}: SettingsSectionTitleProps) {
  return (
    <h2
      data-slot="settings-section-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  )
}

export interface SettingsSectionDescriptionProps extends ComponentProps<"p"> {}

export function SettingsSectionDescription({
  className,
  ...props
}: SettingsSectionDescriptionProps) {
  return (
    <p
      data-slot="settings-section-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export interface SettingsCardProps extends ComponentProps<"div"> {}

export function SettingsCard({ className, ...props }: SettingsCardProps) {
  return (
    <div
      data-slot="settings-card"
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground",
        "divide-y divide-border",
        className,
      )}
      {...props}
    />
  )
}

export interface SettingsRowProps extends ComponentProps<"div"> {}

export function SettingsRow({ className, ...props }: SettingsRowProps) {
  return (
    <div
      data-slot="settings-row"
      className={cn(
        "flex items-center justify-between gap-4 px-5 py-5",
        className,
      )}
      {...props}
    />
  )
}

export interface SettingsRowLabelProps extends ComponentProps<"div"> {}

export function SettingsRowLabel({
  className,
  ...props
}: SettingsRowLabelProps) {
  return (
    <div
      data-slot="settings-row-label"
      className={cn("flex min-w-0 flex-col gap-0.5", className)}
      {...props}
    />
  )
}

export interface SettingsRowTitleProps extends ComponentProps<"span"> {}

export function SettingsRowTitle({
  className,
  ...props
}: SettingsRowTitleProps) {
  return (
    <span
      data-slot="settings-row-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  )
}

export interface SettingsRowDescriptionProps extends ComponentProps<"span"> {}

export function SettingsRowDescription({
  className,
  ...props
}: SettingsRowDescriptionProps) {
  return (
    <span
      data-slot="settings-row-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}
