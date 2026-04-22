import { useNavigate } from "@tanstack/react-router"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { WorkspaceScheduledTasksSection } from "../types"

export interface ScheduledTasksTabsProps {
  currentSection: WorkspaceScheduledTasksSection
  orgSlug: string
}

export function ScheduledTasksTabs({
  currentSection,
  orgSlug,
}: ScheduledTasksTabsProps) {
  const navigate = useNavigate()

  return (
    <Tabs
      onValueChange={(nextValue) => {
        const nextSection = nextValue as WorkspaceScheduledTasksSection
        void navigate({
          params: {
            orgSlug,
          },
          to:
            nextSection === "task-runs"
              ? "/$orgSlug/scheduled-tasks/task-runs"
              : "/$orgSlug/scheduled-tasks/tasks",
        })
      }}
      value={currentSection}
    >
      <TabsList className="h-auto justify-start overflow-x-auto p-1">
        <TabsTrigger value="tasks">Scheduled Tasks</TabsTrigger>
        <TabsTrigger value="task-runs">Task Runs</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
