import { Navigate } from "@tanstack/react-router"

export interface ScheduledTaskDetailRedirectPageProps {
  orgSlug: string
  taskKey: string
}

export function ScheduledTaskDetailRedirectPage({
  orgSlug,
  taskKey,
}: ScheduledTaskDetailRedirectPageProps) {
  return (
    <Navigate
      params={{
        orgSlug,
        taskKey,
      }}
      replace
      to="/$orgSlug/scheduled-tasks/tasks/$taskKey/overview"
    />
  )
}

