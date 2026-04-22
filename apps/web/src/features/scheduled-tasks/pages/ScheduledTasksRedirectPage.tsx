import { Navigate } from "@tanstack/react-router"

export interface ScheduledTasksRedirectPageProps {
  orgSlug: string
}

export function ScheduledTasksRedirectPage({
  orgSlug,
}: ScheduledTasksRedirectPageProps) {
  return (
    <Navigate
      params={{ orgSlug }}
      replace
      to="/$orgSlug/scheduled-tasks/tasks"
    />
  )
}
