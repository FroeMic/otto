import { useSuspenseQuery } from "@tanstack/react-query"

import { platformOrganizationDetailQueryOptions } from "@/features/platform/api/platform"
import { PlatformAccessContent } from "@/features/platform/components/PlatformAccessContent"

function getDashboardUrl() {
  return "http://127.0.0.1:18791/"
}

function getSshTunnelCommand(ipv4: string | null) {
  if (!ipv4) {
    return null
  }

  return `ssh -N -L 18791:127.0.0.1:18791 root@${ipv4}`
}

export interface PlatformOrganizationAccessPageProps {
  orgSlug: string
}

export function PlatformOrganizationAccessPage({
  orgSlug,
}: PlatformOrganizationAccessPageProps) {
  const { data } = useSuspenseQuery(platformOrganizationDetailQueryOptions(orgSlug))
  const organization = data.organization
  const ipv4 = organization.tenant?.ipv4 ?? null
  const hostSshCommand = ipv4 ? `ssh root@${ipv4}` : null
  const hostSshCustomKeyCommand = ipv4
    ? `ssh -i ~/.ssh/id_ed25519_otto root@${ipv4}`
    : null

  return (
    <div className="px-4 md:px-6">
      <PlatformAccessContent
        dashboardUrl={getDashboardUrl()}
        gatewayToken={data.gatewayToken ?? null}
        hostSshCommand={hostSshCommand}
        hostSshCustomKeyCommand={hostSshCustomKeyCommand}
        ipv4={ipv4}
        sshTunnelCommand={getSshTunnelCommand(ipv4)}
      />
    </div>
  )
}
