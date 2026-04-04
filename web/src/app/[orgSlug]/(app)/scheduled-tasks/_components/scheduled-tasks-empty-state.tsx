import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ScheduledTasksEmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Tasks</CardTitle>
        <CardDescription>
          Scheduled work appears here once Otto is provisioned for this
          workspace.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
