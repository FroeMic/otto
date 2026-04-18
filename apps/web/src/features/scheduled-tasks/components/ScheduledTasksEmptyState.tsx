import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ScheduledTasksEmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No scheduled tasks yet</CardTitle>
        <CardDescription>
          This workspace is set up. Scheduled work will appear here after a
          task is created in Otto.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
