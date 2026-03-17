import "dotenv/config";

import crypto from "node:crypto";
import fs from "node:fs";

import { utils as ssh2Utils } from "ssh2";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  HETZNER_ACTION_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  HETZNER_API_BASE_URL: z.url().default("https://api.hetzner.cloud/v1"),
  HETZNER_API_TOKEN: z.string().optional(),
  HETZNER_DEFAULT_IMAGE: z.string().default("ubuntu-24.04"),
  HETZNER_DEFAULT_LOCATION: z.string().default("ash"),
  HETZNER_DEFAULT_SERVER_TYPE: z.string().default("cpx21"),
  HETZNER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  HETZNER_SSH_KEY_NAMES: z.string().default(""),
  RUNTIME_DEPLOY_PRIVATE_KEY: z.string().optional(),
  RUNTIME_DEPLOY_PRIVATE_KEY_PATH: z.string().optional(),
  RUNTIME_OPENCLAW_IMAGE: z
    .string()
    .default("ghcr.io/openclaw/openclaw:latest"),
  RUNTIME_OPENAI_API_KEY: z.string().optional(),
  RUNTIME_MODEL_PRIMARY: z.string().default("openai/gpt-5.4"),
  RUNTIME_SLACK_APP_TOKEN: z.string().optional(),
  SLACK_BOT_SCOPES: z
    .string()
    .default(
      "app_mentions:read,channels:history,channels:read,chat:write,groups:history,groups:read,im:history,im:write,mpim:history,users:read",
    ),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().url().optional(),
  RUNTIME_SSH_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  RUNTIME_SSH_COMMAND_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30000),
  RUNTIME_SSH_PORT: z.coerce.number().int().positive().default(22),
  RUNTIME_SSH_READY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(300000),
  RUNTIME_SSH_USERNAME: z.string().default("root"),
  CONTROL_PLANE_ENCRYPTION_SECRET: z.string().optional(),
  CONTROL_PLANE_BASE_URL: z.string().url().optional(),
  CONTROL_PLANE_OAUTH_STATE_SECRET: z.string().optional(),
  WORKOS_API_KEY: z.string().optional(),
  WORKOS_BASE_URL: z.string().url().optional(),
  WORKOS_CLIENT_ID: z.string().optional(),
  WORKOS_COOKIE_PASSWORD: z.string().optional(),
  WORKOS_REDIRECT_URI: z.string().url().optional(),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(5),
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: z.string().url().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = envSchema.parse(process.env);
  validateRuntimeSshEnv(cachedEnv);
  return cachedEnv;
}

export function getRuntimeSshAuthSource() {
  const env = getEnv();

  return resolveRuntimeSshAuthSource(env);
}

export function getControlPlaneEncryptionSecret() {
  return resolveControlPlaneSecret(
    getEnv().CONTROL_PLANE_ENCRYPTION_SECRET,
    "CONTROL_PLANE_ENCRYPTION_SECRET",
  );
}

export function getControlPlaneOAuthStateSecret() {
  return resolveControlPlaneSecret(
    getEnv().CONTROL_PLANE_OAUTH_STATE_SECRET,
    "CONTROL_PLANE_OAUTH_STATE_SECRET",
  );
}

export function getControlPlaneBaseUrl() {
  const env = getEnv();

  return (
    env.CONTROL_PLANE_BASE_URL ??
    env.WORKOS_BASE_URL ??
    deriveBaseUrlFromUri(
      env.WORKOS_REDIRECT_URI ??
        env.SLACK_REDIRECT_URI ??
        env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
    )
  );
}

export function getSlackOAuthConfig() {
  const env = getEnv();

  if (
    !env.SLACK_CLIENT_ID ||
    !env.SLACK_CLIENT_SECRET ||
    !env.SLACK_REDIRECT_URI
  ) {
    throw new Error("Slack OAuth is not fully configured");
  }

  return {
    botScopes: env.SLACK_BOT_SCOPES.split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
    redirectUri: env.SLACK_REDIRECT_URI,
  };
}

export function hasSlackOAuthConfig() {
  try {
    getSlackOAuthConfig();
    return true;
  } catch {
    return false;
  }
}

export function normalizePrivateKeyValue(value: string) {
  return value.includes("\\n") ? value.replaceAll("\\n", "\n") : value;
}

function deriveBaseUrlFromUri(uri?: string) {
  if (!uri) {
    return "";
  }

  try {
    return new URL(uri).origin;
  } catch {
    return "";
  }
}

function validateRuntimeSshEnv(env: AppEnv) {
  const authSource = resolveRuntimeSshAuthSource(env);

  if (authSource === "env") {
    const privateKey = env.RUNTIME_DEPLOY_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error(
        "RUNTIME_DEPLOY_PRIVATE_KEY auth was selected but the variable is empty",
      );
    }

    assertPrivateKeyIsValid(
      normalizePrivateKeyValue(privateKey),
      "RUNTIME_DEPLOY_PRIVATE_KEY",
    );
    return;
  }

  if (authSource === "path") {
    const keyPath = env.RUNTIME_DEPLOY_PRIVATE_KEY_PATH;

    if (!keyPath) {
      throw new Error(
        "RUNTIME_DEPLOY_PRIVATE_KEY_PATH auth was selected but the variable is empty",
      );
    }

    if (!fs.existsSync(keyPath)) {
      throw new Error(
        `RUNTIME_DEPLOY_PRIVATE_KEY_PATH does not exist: ${keyPath}`,
      );
    }

    const key = fs.readFileSync(keyPath, "utf8");
    assertPrivateKeyIsValid(key, "RUNTIME_DEPLOY_PRIVATE_KEY_PATH");
  }
}

function assertPrivateKeyIsValid(key: string, source: string) {
  const parsedKey = ssh2Utils.parseKey(key);

  if (Array.isArray(parsedKey)) {
    const invalidKey = parsedKey.find((entry) => entry instanceof Error);

    if (!invalidKey) {
      return;
    }

    throw new Error(
      `${source} is not a valid private key: ${invalidKey.message}`,
    );
  }

  if (parsedKey instanceof Error) {
    throw new Error(
      `${source} is not a valid private key: ${parsedKey.message}`,
    );
  }
}

function resolveRuntimeSshAuthSource(env: AppEnv) {
  if (env.RUNTIME_DEPLOY_PRIVATE_KEY) {
    return "env";
  }

  if (env.RUNTIME_DEPLOY_PRIVATE_KEY_PATH) {
    return "path";
  }

  if (process.env.SSH_AUTH_SOCK) {
    return "agent";
  }

  return "none";
}

function resolveControlPlaneSecret(
  value: string | undefined,
  envVarName: string,
) {
  if (value) {
    return deriveFixedLengthSecret(value);
  }

  if (process.env.WORKOS_COOKIE_PASSWORD) {
    return deriveFixedLengthSecret(process.env.WORKOS_COOKIE_PASSWORD);
  }

  throw new Error(
    `${envVarName} is not set and WORKOS_COOKIE_PASSWORD is unavailable for fallback`,
  );
}

function deriveFixedLengthSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest();
}
