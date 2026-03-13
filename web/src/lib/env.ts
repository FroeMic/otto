import "dotenv/config";

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
  return cachedEnv;
}
