import { cn } from "@/lib/utils";

/**
 * Centered, max-width container for a settings page.
 * Keeps content readable on wide screens.
 */
function SettingsPage({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-page"
      className={cn("mx-auto w-full max-w-2xl", className)}
      {...props}
    />
  );
}

/**
 * Page-level heading. Rendered once at the top of a settings page.
 */
function SettingsPageTitle({
  className,
  ...props
}: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="settings-page-title"
      className={cn("text-2xl font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

/**
 * Groups related settings under a shared heading.
 * Renders a title, optional subtitle, then children (cards).
 */
function SettingsSection({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="settings-section"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}

function SettingsSectionTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="settings-section-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
}

function SettingsSectionDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="settings-section-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * Bordered card that contains one or more SettingsRow items.
 * Rows inside are separated by a subtle divider.
 */
function SettingsCard({ className, ...props }: React.ComponentProps<"div">) {
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
  );
}

/**
 * A single row inside a SettingsCard.
 * Displays a label + optional description on the left, and a control on the right.
 */
function SettingsRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-row"
      className={cn(
        "flex items-center justify-between gap-4 px-5 py-5",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Left side of a SettingsRow — label and description stacked vertically.
 */
function SettingsRowLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-row-label"
      className={cn("flex min-w-0 flex-col gap-0.5", className)}
      {...props}
    />
  );
}

function SettingsRowTitle({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="settings-row-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
}

function SettingsRowDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="settings-row-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  SettingsPage,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionTitle,
  SettingsSectionDescription,
  SettingsCard,
  SettingsRow,
  SettingsRowLabel,
  SettingsRowTitle,
  SettingsRowDescription,
};
