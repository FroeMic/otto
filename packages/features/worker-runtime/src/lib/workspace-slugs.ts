export const SYSTEM_RESERVED_WORKSPACE_SLUGS = [
  "api",
  "api-docs",
  "app",
  "auth",
  "login",
  "logout",
  "oauth",
  "platform",
  "status",
  "webhooks",
] as const;

export const PUBLIC_RESERVED_WORKSPACE_SLUGS = [
  "about",
  "agents",
  "android",
  "asks",
  "blog",
  "brand",
  "build",
  "careers",
  "change",
  "changelog",
  "contact",
  "customers",
  "developers",
  "docs",
  "download",
  "dpa",
  "features",
  "fm",
  "insights",
  "integrations",
  "ios",
  "method",
  "mobile",
  "now",
  "plan",
  "pricing",
  "privacy",
  "quality",
  "readme",
  "releases",
  "security",
  "startups",
  "switch",
  "terms",
] as const;

export const RESERVED_WORKSPACE_SLUGS = [
  ...SYSTEM_RESERVED_WORKSPACE_SLUGS,
  ...PUBLIC_RESERVED_WORKSPACE_SLUGS,
] as const;

const RESERVED_WORKSPACE_SLUG_SET = new Set<string>(RESERVED_WORKSPACE_SLUGS);

export function normalizeWorkspaceSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isReservedWorkspaceSlug(value: string) {
  const normalizedValue = normalizeWorkspaceSlug(value);

  return normalizedValue.length > 0
    ? RESERVED_WORKSPACE_SLUG_SET.has(normalizedValue)
    : false;
}
