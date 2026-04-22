import * as z from "zod"

const envSchema = z.object({
  API_ORIGIN: z.string().url().default("http://127.0.0.1:3002"),
  FRONTEND_PORT: z.coerce.number().int().positive().default(4100),
  NEXT_PUBLIC_POSTHOG_ENABLED: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === "true" || value === "1"),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().default("/ingest"),
  NEXT_PUBLIC_POSTHOG_TOKEN: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  POSTHOG_ASSET_PROXY_TARGET: z
    .string()
    .url()
    .default("https://eu-assets.i.posthog.com"),
  POSTHOG_PROXY_TARGET: z.string().url().default("https://eu.i.posthog.com"),
  WORKSPACE_APP_ORIGIN: z.string().url().default("https://app.getyourotto.com"),
})

export type FrontendEnv = z.infer<typeof envSchema>

export function getEnv(): FrontendEnv {
  return envSchema.parse(process.env)
}
