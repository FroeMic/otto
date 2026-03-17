import { WorkOS } from "@workos-inc/node";

import { getEnv } from "@/lib/env";

function getWorkOSEnv() {
  const env = getEnv();
  const redirectUri =
    env.WORKOS_REDIRECT_URI ?? env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? "";

  return {
    apiKey: env.WORKOS_API_KEY ?? "",
    baseURL: env.WORKOS_BASE_URL ?? deriveBaseUrlFromRedirectUri(redirectUri),
    clientId: env.WORKOS_CLIENT_ID ?? "",
    cookiePassword: env.WORKOS_COOKIE_PASSWORD ?? "",
    redirectUri,
  };
}

export function hasWorkOSConfig() {
  const env = getWorkOSEnv();

  return Boolean(
    env.clientId &&
      env.apiKey &&
      env.cookiePassword &&
      env.cookiePassword.length >= 32 &&
      env.redirectUri,
  );
}

export function getWorkOSAuthConfig() {
  const env = getWorkOSEnv();

  if (!hasWorkOSConfig()) {
    throw new Error("WorkOS is not configured");
  }

  return env;
}

export function getWorkOS() {
  const env = getWorkOSAuthConfig();

  return new WorkOS(env.apiKey);
}

function deriveBaseUrlFromRedirectUri(redirectUri: string) {
  if (!redirectUri) {
    return "";
  }

  try {
    return new URL(redirectUri).origin;
  } catch {
    return "";
  }
}
