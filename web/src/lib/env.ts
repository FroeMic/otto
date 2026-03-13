import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(5),
  WORKOS_CLIENT_ID: z.string().default(""),
  WORKOS_API_KEY: z.string().default(""),
  WORKOS_COOKIE_PASSWORD: z.string().default(""),
  HETZNER_API_TOKEN: z.string().default(""),
  RUNTIME_DEPLOY_PRIVATE_KEY: z.string().default(""),
  RUNTIME_DEPLOY_PUBLIC_KEY: z.string().default(""),
  RUNTIME_SSH_USERNAME: z.string().default("openclaw"),
  RUNTIME_SSH_PORT: z.coerce.number().int().positive().default(22),
  RUNTIME_SSH_READY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(300000),
  RUNTIME_SSH_COMMAND_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30000),
  RUNTIME_SSH_KNOWN_HOSTS: z.string().default(""),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}
