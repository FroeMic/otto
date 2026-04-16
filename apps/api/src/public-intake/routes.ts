import { Hono } from "hono"

import { getApiEnv } from "../env"
import {
  createPublicIntakeSession as createPublicIntakeSessionInDb,
  transcribePublicIntakeAudio as transcribePublicIntakeAudioInDb,
} from "./data"

export type PublicIntakeRouteDependencies = {
  createPublicIntakeSession: (input: {
    prompt: string
    source?: string
  }) => Promise<{
    id: string
  }>
  publicBaseUrl: string
  transcribePublicIntakeAudio: (input: { file: File }) => Promise<string>
}

function createDefaultPublicIntakeRouteDependencies(): PublicIntakeRouteDependencies {
  const env = getApiEnv()

  return {
    createPublicIntakeSession: createPublicIntakeSessionInDb,
    publicBaseUrl: env.PUBLIC_APP_BASE_URL,
    transcribePublicIntakeAudio: transcribePublicIntakeAudioInDb,
  }
}

function normalizeReturnTo(returnTo: string | null | undefined) {
  if (!returnTo || returnTo.trim().length === 0) {
    return "/"
  }

  return returnTo
}

export function createPublicIntakeRouter(
  dependencies: PublicIntakeRouteDependencies = createDefaultPublicIntakeRouteDependencies(),
) {
  const app = new Hono()

  return app
    .post("/api/public/intake", async (context) => {
      const formData = await context.req.formData()
      const prompt = String(formData.get("prompt") ?? "").trim()
      const returnTo = normalizeReturnTo(
        typeof formData.get("returnTo") === "string"
          ? String(formData.get("returnTo"))
          : null,
      )

      if (prompt.length === 0) {
        return context.json(
          {
            error: "Missing prompt",
          },
          400,
          {
            "Cache-Control": "no-store",
          },
        )
      }

      const intakeSession = await dependencies.createPublicIntakeSession({
        prompt,
        source: "landing",
      })
      const nextReturnTo = new URL(returnTo, dependencies.publicBaseUrl)

      nextReturnTo.searchParams.set("intake", intakeSession.id)
      const location = `${new URL("/login", dependencies.publicBaseUrl).toString()}?returnTo=${encodeURIComponent(
        `${nextReturnTo.pathname}${nextReturnTo.search}${nextReturnTo.hash}`,
      )}&prompt=${encodeURIComponent(prompt)}`

      return Response.redirect(location, 302)
    })
    .post("/api/public/intake/transcribe", async (context) => {
      const formData = await context.req.formData()
      const file = formData.get("file")

      if (!(file instanceof File)) {
        return context.json(
          {
            error: "Missing file",
          },
          400,
          {
            "Cache-Control": "no-store",
          },
        )
      }

      const transcript = await dependencies.transcribePublicIntakeAudio({
        file,
      })

      return context.json(
        {
          transcript,
        },
        200,
        {
          "Cache-Control": "no-store",
        },
      )
    })
}

export function registerPublicIntakeRoutes(
  app: Hono,
  dependencies: PublicIntakeRouteDependencies = createDefaultPublicIntakeRouteDependencies(),
) {
  return app.route("/", createPublicIntakeRouter(dependencies))
}
