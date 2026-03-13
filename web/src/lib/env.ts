import "dotenv/config";

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
  RUNTIME_SSH_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  RUNTIME_SSH_PORT: z.coerce.number().int().positive().default(22),
  RUNTIME_SSH_READY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(300000),
  RUNTIME_SSH_USERNAME: z.string().default("root"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(5),
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

export function normalizePrivateKeyValue(value: string) {
  return value.includes("\\n") ? value.replaceAll("\\n", "\n") : value;
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
