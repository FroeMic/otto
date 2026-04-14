import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { publicIntakeSessions } from "@otto/feature-integrations-runtime/db/schema"

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
