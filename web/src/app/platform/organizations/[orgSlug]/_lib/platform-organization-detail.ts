import { cache } from "react";
import { notFound } from "next/navigation";

import { loadPlatformRouteContext } from "@/app/platform/_lib/platform-context";
import {
  getPlatformOrganizationDetail,
  getTenantRuntimeGatewayToken,
} from "@/db/control-plane";

export const loadPlatformOrganizationDetailRouteContext = cache(
  async (orgSlug: string) => {
    const { organizations, user } = await loadPlatformRouteContext();
    const organization = await getPlatformOrganizationDetail({
      orgSlug,
      userExternalId: user.id,
    });

    if (!organization) {
      notFound();
    }

    const runtimeReady =
      organization.tenant?.status === "ready" &&
      organization.tenant.serverStatus === "ready";

    return {
      organization,
      organizations,
      runtimeReady,
      user,
    };
  },
);

export const loadPlatformOrganizationAccessRouteContext = cache(
  async (orgSlug: string) => {
    const context = await loadPlatformOrganizationDetailRouteContext(orgSlug);
    const gatewayToken = context.organization.tenant
      ? await getTenantRuntimeGatewayToken(context.organization.tenant.id)
      : null;

    return {
      ...context,
      gatewayToken,
    };
  },
);

export function formatTimestamp(value: Date | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function formatStatus(status: string | null) {
  if (!status) {
    return "Not available";
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getStatusVariant(status: string | null) {
  switch (status) {
    case "connected":
    case "ready":
    case "succeeded":
      return "secondary" as const;
    case "failed":
    case "error":
    case "apply_failed":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function getRuntimeImageHref(image: string) {
  if (!image.startsWith("ghcr.io/")) {
    return null;
  }

  const [repository] = image.replace("ghcr.io/", "").split(":");
  const [owner, packageName] = repository.split("/");

  if (!owner || !packageName) {
    return null;
  }

  return `https://github.com/orgs/${owner}/packages/container/package/${packageName}`;
}

export function getDashboardUrl() {
  return "http://127.0.0.1:18791/";
}

export function getSshTunnelCommand(ipv4: string | null) {
  if (!ipv4) {
    return null;
  }

  return `ssh -N -L 18791:127.0.0.1:18791 root@${ipv4}`;
}
