import assert from "node:assert/strict"

import { describe, it, vi } from "vitest"

import { __testing } from "./delete-workspace"

type AppendJobEvent = typeof import("./queue").appendJobEvent

describe("delete workspace OpenAI cleanup", () => {
  it("continues when service account deletion finds an archived project", async () => {
    const appendJobEvent = vi.fn<AppendJobEvent>(async () => undefined)
    const deleteTenantCredential = vi.fn(async () => {
      throw new Error(
        "Project 'proj_123' is archived. You can only delete service accounts for an active project. code=project_archived type=invalid_request_error",
      )
    })
    const archiveProject = vi.fn(async () => {
      throw new Error(
        "Project 'proj_123' is archived. code=project_archived type=invalid_request_error",
      )
    })

    const deletedCount = await __testing.deleteOpenAiResources({
      appendJobEvent,
      jobId: "job_123",
      openAiCredentials: [
        {
          projectId: "proj_123",
          serviceAccountId: "svc_123",
          tenantId: "tenant_123",
        },
      ],
      openAiProvisioner: {
        archiveProject,
        deleteTenantCredential,
      },
    })

    assert.equal(deletedCount, 0)
    assert.equal(deleteTenantCredential.mock.calls.length, 1)
    assert.deepEqual(archiveProject.mock.calls, [["proj_123"]])
    assert.equal(
      appendJobEvent.mock.calls.some(
        ([, eventType]) =>
          eventType === "skipped_openai_service_account_deletion",
      ),
      true,
    )
  })
})
