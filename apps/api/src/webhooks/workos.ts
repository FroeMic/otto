import { WorkOS } from "@workos-inc/node"

import { getApiEnv } from "../env"
import {
  reconcileWorkspaceMembershipProjectionForUser,
  syncOrganizationProjectionFromWorkOs,
} from "../workspace/data"

type WorkOsWebhookEvent = {
  data: Record<string, unknown>
  event: string
  id?: string
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  })
}

function getWebhookSignatureHeader(headers: Headers) {
  return (
    headers.get("workos-signature") ??
    headers.get("x-workos-signature") ??
    headers.get("webhook-signature")
  )
}

async function verifyWorkOsWebhook(input: {
  rawPayload: string
  secret: string
  sigHeader: string
}) {
  const env = getApiEnv()
  const workos = new WorkOS(env.WORKOS_API_KEY ?? "", {
    clientId: env.WORKOS_CLIENT_ID,
  })
  const payload = JSON.parse(input.rawPayload) as Record<string, unknown>

  return (await workos.webhooks.constructEvent({
    payload,
    secret: input.secret,
    sigHeader: input.sigHeader,
  })) as WorkOsWebhookEvent
}

export async function handleWorkOsWebhookRequest(request: Request) {
  const secret = process.env.WORKOS_WEBHOOK_SECRET?.trim()

  if (!secret) {
    return json(
      { ok: false, error: "WorkOS webhook secret is not configured" },
      501,
    )
  }

  const sigHeader = getWebhookSignatureHeader(request.headers)

  if (!sigHeader) {
    return json({ ok: false, error: "Missing WorkOS signature header" }, 400)
  }

  const rawPayload = await request.text()

  try {
    const event = await verifyWorkOsWebhook({
      rawPayload,
      secret,
      sigHeader,
    })

    switch (event.event) {
      case "organization_membership.created":
      case "organization_membership.deleted":
      case "organization_membership.updated":
        if (typeof event.data.userId === "string") {
          await reconcileWorkspaceMembershipProjectionForUser(event.data.userId)
        }
        break
      case "organization.updated":
        if (
          typeof event.data.id === "string" &&
          typeof event.data.name === "string"
        ) {
          await syncOrganizationProjectionFromWorkOs({
            organization: {
              id: event.data.id,
              name: event.data.name,
            },
          })
        }
        break
      default:
        break
    }

    return json({ ok: true })
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process WorkOS webhook",
      },
      400,
    )
  }
}
