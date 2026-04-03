import {
  formatTimestamp,
  loadPlatformOrganizationDetailRouteContext,
} from "@/app/platform/organizations/[orgSlug]/_lib/platform-organization-detail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PlatformOrganizationLogsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization } =
    await loadPlatformOrganizationDetailRouteContext(orgSlug);
  const latestApplyRun = organization.tenant?.recentApplyRuns[0] ?? null;
  const diagnostics = [
    ["Restart stdout", latestApplyRun?.restartStdout ?? null],
    ["Restart stderr", latestApplyRun?.restartStderr ?? null],
    ["Verify stdout", latestApplyRun?.verifyStdout ?? null],
    ["Verify stderr", latestApplyRun?.verifyStderr ?? null],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <div className="grid gap-4 px-4 pb-6 md:px-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>
            This tab is reserved for the live runtime log view in the next
            operator slice.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert>
            <AlertTitle>Live runtime logs are next</AlertTitle>
            <AlertDescription>
              The next step will move container/runtime log inspection here and
              back it with a dedicated operator read path instead of the current
              inline runtime restart route.
            </AlertDescription>
          </Alert>
          {latestApplyRun ? (
            <div className="text-sm text-muted-foreground">
              Latest apply attempt: v{latestApplyRun.desiredStateVersion} at{" "}
              {formatTimestamp(
                latestApplyRun.finishedAt ?? latestApplyRun.startedAt,
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Latest stored diagnostics</CardTitle>
          <CardDescription>
            Until the live log view exists, the latest apply output is available
            here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {diagnostics.length > 0 ? (
            diagnostics.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {label}
                </div>
                <pre className="max-h-48 overflow-auto rounded-2xl border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                  {value}
                </pre>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No stored apply diagnostics are available yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
