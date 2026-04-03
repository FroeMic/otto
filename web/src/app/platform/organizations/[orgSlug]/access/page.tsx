import {
  getDashboardUrl,
  getSshTunnelCommand,
  loadPlatformOrganizationAccessRouteContext,
} from "@/app/platform/organizations/[orgSlug]/_lib/platform-organization-detail";
import { GatewayAccessCard } from "@/app/[orgSlug]/(app)/agent/_components/gateway-access-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PlatformOrganizationAccessPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { gatewayToken, organization } =
    await loadPlatformOrganizationAccessRouteContext(orgSlug);

  return (
    <div className="grid gap-4 px-4 pb-6 md:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <GatewayAccessCard
        dashboardUrl={getDashboardUrl()}
        gatewayToken={gatewayToken}
        sshTunnelCommand={getSshTunnelCommand(
          organization.tenant?.ipv4 ?? null,
        )}
      />
      <Card>
        <CardHeader>
          <CardTitle>Access notes</CardTitle>
          <CardDescription>
            Use this page when you need direct runtime dashboard access for
            debugging.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert>
            <AlertTitle>Access stays local</AlertTitle>
            <AlertDescription>
              The shown dashboard URL is only reachable through an SSH tunnel to
              the tenant server. No public runtime URL is exposed here.
            </AlertDescription>
          </Alert>
          <div className="text-sm text-muted-foreground">
            If the server IP or gateway token is missing, the runtime has not
            finished enough bootstrap/apply work to present dashboard access
            yet.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
