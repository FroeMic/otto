import assert from "node:assert/strict"

import { describe, it } from "vitest"

import {
  platformCreateOrganizationSchema,
  platformLatestJobSummarySchema,
} from "./index"

describe("platform feature contracts", () => {
  it("trims organization creation input and rejects invalid slugs", () => {
    assert.deepEqual(
      platformCreateOrganizationSchema.parse({
        name: "  Acme Labs  ",
        slug: "acme-labs",
      }),
      {
        name: "Acme Labs",
        slug: "acme-labs",
      },
    )

    assert.equal(
      platformCreateOrganizationSchema.safeParse({
        name: "Acme Labs",
        slug: "Acme_Labs",
      }).success,
      false,
    )
  })

  it("normalizes job summary dates for JSON responses", () => {
    const parsed = platformLatestJobSummarySchema.parse({
      attempt: 1,
      createdAt: new Date("2026-04-01T12:00:00.000Z"),
      error: null,
      events: [
        {
          createdAt: new Date("2026-04-01T12:01:00.000Z"),
          eventType: "started",
          message: "Started",
        },
      ],
      finishedAt: null,
      id: "job_1",
      jobType: "provision_tenant_server",
      startedAt: "2026-04-01T12:00:30.000Z",
      status: "running",
      step: "provision",
    })

    assert.equal(parsed.createdAt, "2026-04-01T12:00:00.000Z")
    assert.equal(parsed.events[0]?.createdAt, "2026-04-01T12:01:00.000Z")
    assert.equal(parsed.startedAt, "2026-04-01T12:00:30.000Z")
  })
})
