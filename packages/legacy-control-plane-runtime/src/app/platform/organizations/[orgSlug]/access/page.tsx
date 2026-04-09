import {
  getDashboardUrl,
  getSshTunnelCommand,
  loadPlatformOrganizationAccessRouteContext,
} from "../_lib/platform-organization-detail";
import { PlatformAccessContent } from "./_components/platform-access-content";

export default async function PlatformOrganizationAccessPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { gatewayToken, organization } =
    await loadPlatformOrganizationAccessRouteContext(orgSlug);
  const ipv4 = organization.tenant?.ipv4 ?? null;
  const hostSshCommand = ipv4 ? `ssh root@${ipv4}` : null;
  const hostSshCustomKeyCommand = ipv4
    ? `ssh -i ~/.ssh/id_ed25519_otto root@${ipv4}`
    : null;

  return (
    <div className="px-4 md:px-6">
      <PlatformAccessContent
        dashboardUrl={getDashboardUrl()}
        gatewayToken={gatewayToken}
        hostSshCommand={hostSshCommand}
        hostSshCustomKeyCommand={hostSshCustomKeyCommand}
        ipv4={ipv4}
        sshTunnelCommand={getSshTunnelCommand(ipv4)}
      />
    </div>
  );
}
