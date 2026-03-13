import { WorkOS } from "@workos-inc/node";

function getWorkOSEnv() {
  return {
    clientId: process.env.WORKOS_CLIENT_ID ?? "",
    apiKey: process.env.WORKOS_API_KEY ?? "",
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD ?? "",
    redirectUri: process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? "",
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

export function getWorkOS() {
  const env = getWorkOSEnv();

  if (!hasWorkOSConfig()) {
    throw new Error("WorkOS is not configured");
  }

  return new WorkOS(env.apiKey);
}
