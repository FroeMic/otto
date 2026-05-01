import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  publicIntakeSessions,
  waitlistSignups,
} from "@otto/feature-integrations-runtime/db/schema"
import { sql } from "drizzle-orm"

import { getControlPlaneOpenAiAdminApiKey } from "../env"

const OPENAI_AUDIO_TRANSCRIPTIONS_URL =
  "https://api.openai.com/v1/audio/transcriptions"
const MAX_PUBLIC_INTAKE_AUDIO_SIZE_BYTES = 25 * 1024 * 1024

export async function createPublicIntakeSession(input: {
  prompt: string
  source?: string
}) {
  const db = getDb()
  const [session] = await db
    .insert(publicIntakeSessions)
    .values({
      prompt: input.prompt,
      source: input.source ?? "landing",
    })
    .returning({
      id: publicIntakeSessions.id,
    })

  if (!session) {
    throw new Error("Failed to create public intake session")
  }

  return session
}

export async function createWaitlistSignup(input: {
  company: string
  email: string
  heardAbout: string
  name: string
  useCase: string
}) {
  const db = getDb()
  const [signup] = await db
    .insert(waitlistSignups)
    .values({
      company: input.company,
      email: input.email,
      heardAbout: input.heardAbout,
      name: input.name,
      useCase: input.useCase,
    })
    .onConflictDoUpdate({
      set: {
        company: input.company,
        heardAbout: input.heardAbout,
        name: input.name,
        updatedAt: sql`now()`,
        useCase: input.useCase,
      },
      target: waitlistSignups.email,
    })
    .returning({
      id: waitlistSignups.id,
    })

  if (!signup) {
    throw new Error("Failed to create waitlist signup")
  }

  return signup
}

export async function transcribePublicIntakeAudio(input: { file: File }) {
  validatePublicIntakeAudioFile(input.file)

  const formData = new FormData()
  formData.set(
    "file",
    new File(
      [new Uint8Array(await input.file.arrayBuffer())],
      input.file.name,
      {
        type: input.file.type,
      },
    ),
  )
  formData.set("model", "gpt-4o-mini-transcribe")

  const response = await fetch(OPENAI_AUDIO_TRANSCRIPTIONS_URL, {
    body: formData,
    headers: {
      Authorization: `Bearer ${getControlPlaneOpenAiAdminApiKey()}`,
    },
    method: "POST",
  })

  if (!response.ok) {
    throw new Error(
      `Public intake transcription failed with status ${response.status}.`,
    )
  }

  const payload = (await response.json()) as { text?: unknown }
  const transcript = typeof payload.text === "string" ? payload.text.trim() : ""

  return transcript
}

function validatePublicIntakeAudioFile(file: File) {
  if (!file.name.trim()) {
    throw new Error("Public intake audio filename is required.")
  }

  if (file.size <= 0) {
    throw new Error("Public intake audio file is empty.")
  }

  if (file.size > MAX_PUBLIC_INTAKE_AUDIO_SIZE_BYTES) {
    throw new Error(
      `Public intake audio must be ${Math.floor(MAX_PUBLIC_INTAKE_AUDIO_SIZE_BYTES / (1024 * 1024))} MB or smaller.`,
    )
  }

  const mimeType = file.type.trim().toLowerCase()

  if (!mimeType.startsWith("audio/") && !mimeType.startsWith("video/")) {
    throw new Error("Public intake audio must be an audio or video file.")
  }
}
