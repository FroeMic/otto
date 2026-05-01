import { Hono } from "hono"

import { getApiEnv } from "../env"
import {
  createPublicIntakeSession as createPublicIntakeSessionInDb,
  createWaitlistSignup as createWaitlistSignupInDb,
  transcribePublicIntakeAudio as transcribePublicIntakeAudioInDb,
} from "./data"

export type PublicIntakeRouteDependencies = {
  createPublicIntakeSession: (input: {
    prompt: string
    source?: string
  }) => Promise<{
    id: string
  }>
  createWaitlistSignup: (input: {
    company: string
    email: string
    heardAbout: string
    name: string
    useCase: string
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
    createWaitlistSignup: createWaitlistSignupInDb,
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

function getTrimmedFormValue(formData: FormData, key: string) {
  const value = formData.get(key)

  return typeof value === "string" ? value.trim() : ""
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function createPublicIntakeRouter(
  dependencies: PublicIntakeRouteDependencies = createDefaultPublicIntakeRouteDependencies(),
) {
  const app = new Hono()

  return app
    .post("/api/public/waitlist", async (context) => {
      const formData = await context.req.formData()
      const name = getTrimmedFormValue(formData, "name")
      const email = normalizeEmail(getTrimmedFormValue(formData, "email"))
      const company = getTrimmedFormValue(formData, "company")
      const useCase = getTrimmedFormValue(formData, "useCase")
      const heardAbout = getTrimmedFormValue(formData, "heardAbout")

      if (!isValidEmail(email)) {
        return context.json(
          {
            error: "Enter a valid email address.",
          },
          400,
          {
            "Cache-Control": "no-store",
          },
        )
      }

      if (
        name.length === 0 ||
        company.length === 0 ||
        useCase.length === 0 ||
        heardAbout.length === 0
      ) {
        return context.json(
          {
            error: "Complete every waitlist field.",
          },
          400,
          {
            "Cache-Control": "no-store",
          },
        )
      }

      await dependencies.createWaitlistSignup({
        company,
        email,
        heardAbout,
        name,
        useCase,
      })

      return Response.redirect(
        new URL("/waitlist?joined=1", dependencies.publicBaseUrl).toString(),
        303,
      )
    })
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
