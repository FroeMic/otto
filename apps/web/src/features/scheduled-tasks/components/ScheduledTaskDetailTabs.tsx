import { useNavigate } from "@tanstack/react-router"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { WorkspaceScheduledTaskDetailSection } from "../types"

export interface ScheduledTaskDetailTabsProps {
  currentSection: WorkspaceScheduledTaskDetailSection
  orgSlug: string
  taskKey: string
}

export function ScheduledTaskDetailTabs({
  currentSection,
  orgSlug,
  taskKey,
}: ScheduledTaskDetailTabsProps) {
  const navigate = useNavigate()

  return (
    <Tabs
      onValueChange={(nextValue) => {
        const nextSection = nextValue as WorkspaceScheduledTaskDetailSection
        void navigate({
          params: {
            orgSlug,
            taskKey,
          },
          to:
            nextSection === "configuration"
              ? "/$orgSlug/scheduled-tasks/tasks/$taskKey/configuration"
              : nextSection === "task-runs"
                ? "/$orgSlug/scheduled-tasks/tasks/$taskKey/task-runs"
                : "/$orgSlug/scheduled-tasks/tasks/$taskKey/overview",
        })
      }}
      value={currentSection}
    >
      <TabsList className="h-auto justify-start overflow-x-auto p-1">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="configuration">Configuration</TabsTrigger>
        <TabsTrigger value="task-runs">Task Runs</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
