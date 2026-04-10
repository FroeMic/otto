import { getDb } from "@otto/feature-integrations-runtime/db/client"
import {
  jobEvents,
  jobRuns,
} from "@otto/feature-integrations-runtime/db/schema"

import type { JobType } from "./types"

export async function enqueueJob(input: {
  availableAt?: Date
  jobType: JobType
  payload: Record<string, unknown>
}) {
  const db = getDb()
  const tenantId =
    typeof input.payload.tenantId === "string" ? input.payload.tenantId : null

  const [createdJob] = await db
    .insert(jobRuns)
    .values({
      availableAt: input.availableAt ?? new Date(),
      jobType: input.jobType,
      payloadJson: input.payload,
      status: "queued",
      tenantId,
    })
    .returning({
      id: jobRuns.id,
    })

  if (createdJob) {
    await db.insert(jobEvents).values({
      dataJson: {
        jobType: input.jobType,
      },
      eventType: "queued",
      jobRunId: createdJob.id,
      message: "Job queued for execution",
    })
  }

  return createdJob.id
}
