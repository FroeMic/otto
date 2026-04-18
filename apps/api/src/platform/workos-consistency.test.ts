import assert from "node:assert/strict"

import { beforeEach, describe, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createdMembership: {
    id: "om_platform_admin_1",
    role: {
      slug: "admin",
    },
    status: "active",
  },
  createdOrganization: {
    id: "org_workos_platform_1",
    name: "Fresh Workspace",
  },
  createOrganization: vi.fn(),
  createOrganizationMembership: vi.fn(),
  deleteOrganization: vi.fn(),
  listOrganizationMemberships: vi.fn(),
  updateOrganizationMembership: vi.fn(),
  getDb: vi.fn(),
}))

vi.mock("@otto/feature-integrations-runtime/db/client", () => ({
  getDb: mocks.getDb,
}))

vi.mock("@workos-inc/node", () => ({
  WorkOS: vi.fn(() => ({
    organizations: {
      createOrganization: mocks.createOrganization,
      deleteOrganization: mocks.deleteOrganization,
    },
    userManagement: {
      createOrganizationMembership: mocks.createOrganizationMembership,
      listOrganizationMemberships: mocks.listOrganizationMemberships,
      updateOrganizationMembership: mocks.updateOrganizationMembership,
    },
  })),
}))

function configureWorkOsEnv() {
  process.env.WORKOS_API_KEY = "sk_test"
  process.env.WORKOS_CLIENT_ID = "client_test"
  process.env.WORKOS_COOKIE_PASSWORD = "x".repeat(32)
}

function createSelectChain(results: unknown[][]) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    limit: vi.fn(async () => results.shift() ?? []),
    where: vi.fn(() => chain),
  }

  return vi.fn(() => ({
    from: chain.from,
    innerJoin: chain.innerJoin,
    limit: chain.limit,
    where: chain.where,
  }))
}

function createPlatformDbMock(input: {
  insertResult?: unknown[]
  selectResults?: unknown[][]
}) {
  const insertedValues: unknown[] = []
  const onConflictUpdates: unknown[] = []
  const insertResult = input.insertResult ?? [
    {
      id: "org_local_1",
      isReady: false,
      locale: "en-US",
      name: "Fresh Workspace",
      slug: "fresh-workspace",
      timeFormatPreference: "auto",
      timezone: "UTC",
    },
  ]

  return {
    db: {
      insert: vi.fn(() => ({
        values: vi.fn((values: unknown) => {
          insertedValues.push(values)

          return {
            onConflictDoUpdate: vi.fn((config: unknown) => {
              onConflictUpdates.push(config)

              return {
                returning: vi.fn(async () => insertResult),
              }
            }),
            returning: vi.fn(async () => insertResult),
          }
        }),
      })),
      select: createSelectChain(input.selectResults ?? [[]]),
    },
    insertedValues,
    onConflictUpdates,
  }
}

describe("platform WorkOS consistency", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    configureWorkOsEnv()
    mocks.createOrganization.mockResolvedValue(mocks.createdOrganization)
    mocks.createOrganizationMembership.mockResolvedValue(mocks.createdMembership)
    mocks.deleteOrganization.mockResolvedValue(undefined)
    mocks.listOrganizationMemberships.mockResolvedValue({
      autoPagination: async () => [],
    })
    mocks.updateOrganizationMembership.mockResolvedValue(mocks.createdMembership)
  })

  it("creates platform workspaces with a real WorkOS organization id", async () => {
    const dbMock = createPlatformDbMock({
      selectResults: [[]],
    })
    mocks.getDb.mockReturnValue(dbMock.db)

    const { createPlatformOrganization } = await import("./data")

    await createPlatformOrganization({
      name: "Fresh Workspace",
      slug: "fresh-workspace",
      userExternalId: "user_1",
    })

    assert.equal(mocks.createOrganization.mock.calls.length, 1)
    assert.deepEqual(mocks.createOrganization.mock.calls[0]?.[0], {
      name: "Fresh Workspace",
    })
    assert.equal(
      (dbMock.insertedValues[0] as { externalId: string }).externalId,
      "org_workos_platform_1",
    )
  })

  it("deletes the WorkOS organization if the local projection insert fails", async () => {
    const dbMock = createPlatformDbMock({
      insertResult: [],
      selectResults: [[]],
    })
    mocks.getDb.mockReturnValue(dbMock.db)

    const { createPlatformOrganization } = await import("./data")

    await assert.rejects(
      createPlatformOrganization({
        name: "Fresh Workspace",
        slug: "fresh-workspace",
        userExternalId: "user_1",
      }),
      /Failed to create platform organization/,
    )

    assert.equal(mocks.deleteOrganization.mock.calls.length, 1)
    assert.equal(mocks.deleteOrganization.mock.calls[0]?.[0], "org_workos_platform_1")
  })

  it("adds the current user through WorkOS and stores the WorkOS membership id", async () => {
    const dbMock = createPlatformDbMock({
      insertResult: [
        {
          id: "membership_local_1",
          organizationId: "org_local_1",
          role: "admin",
          status: "active",
        },
      ],
      selectResults: [
        [
          {
            externalId: "org_workos_platform_1",
            id: "org_local_1",
            name: "Fresh Workspace",
            slug: "fresh-workspace",
          },
        ],
        [
          {
            id: "user_local_1",
          },
        ],
      ],
    })
    mocks.getDb.mockReturnValue(dbMock.db)

    const { addCurrentUserAsPlatformOrganizationAdmin } = await import("./data")

    await addCurrentUserAsPlatformOrganizationAdmin({
      orgSlug: "fresh-workspace",
      userExternalId: "user_workos_1",
    })

    assert.deepEqual(mocks.createOrganizationMembership.mock.calls[0]?.[0], {
      organizationId: "org_workos_platform_1",
      roleSlug: "admin",
      userId: "user_workos_1",
    })
    assert.equal(
      (dbMock.insertedValues[0] as { externalId: string }).externalId,
      "om_platform_admin_1",
    )
    assert.equal(
      (
        dbMock.onConflictUpdates[0] as {
          set: { externalId: string }
        }
      ).set.externalId,
      "om_platform_admin_1",
    )
  })
})
