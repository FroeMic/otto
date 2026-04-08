import { z } from "zod"

const envSchema = z.object({
  FRONTEND_PORT: z.coerce.number().int().positive().default(4100),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  WORKSPACE_APP_ORIGIN: z.string().url().default("https://app.getyourotto.com"),
})

export type FrontendEnv = z.infer<typeof envSchema>

export function getEnv(): FrontendEnv {
  return envSchema.parse(process.env)
}
