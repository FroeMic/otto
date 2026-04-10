import { zValidator } from "@hono/zod-validator"
import {
  authenticateWorkspaceSessionRequest,
  isWorkspaceSessionAuthError,
  jsonNoStore,
} from "@otto/auth"
import {
  billingCheckoutSchema,
  billingOverviewSchema,
  billingPreferencesResponseSchema,
  billingPreferencesSchema,
  billingUrlResponseSchema,
  type BillingPreferences,
} from "@otto/feature-billing"
import type { WorkspaceShellUser } from "@otto/feature-workspace-core"
import { Hono } from "hono"
import { z } from "zod"

import { getApiEnv } from "../env"
import { getOrganizationWorkspaceBySlug, syncUserFromSession } from "../workspace/data"
import {
  DEFAULT_BILLING_PREFERENCES,
  findBillingCustomerByOrganizationId,
  getBillingCycleWindow,
  getWorkspaceBillingOverview,
  recordBillingCheckoutSession,
  upsertBillingCustomerRecord,
  upsertBillingPreferences,
  type BillingPreferencesRecord,
} from "./data"
import { getAutoTopOffPacks, getBillingPlanByKey } from "./plans"
import {
  getStripe,
  getStripeAutoTopOffPaymentMethodStatus,
  getStripeBillingCycleSpendCents,
  getStripeRecurringPriceIdForPlanKey,
  hasStripeBillingConfig,
  listStripeInvoicesForCustomer,
  previewStripeTopUpInvoiceCharge,
} from "./stripe"

const workspaceParamsSchema = z.object({
  orgSlug: z.string().min(1),
})

const allowedTopOffAmountCents = new Set(
  getAutoTopOffPacks().map((pack) => pack.amountCents),
)

const validatedBillingPreferencesSchema = billingPreferencesSchema.superRefine(
  (value, context) => {
    if (!allowedTopOffAmountCents.has(value.topOffAmountCents)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select one of the supported auto-top-off pack amounts.",
        path: ["topOffAmountCents"],
      })
    }
  },
)

export type BillingRouteDependencies = {
  authenticateWorkspaceUser?: (request: Request) => Promise<WorkspaceShellUser>
  createBillingPortal?: (payload: {
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<{ url: string }>
  createCheckoutSession?: (payload: {
    body: z.infer<typeof billingCheckoutSchema>
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<{ url: string | null }>
  getBillingOverview: (payload: {
    orgSlug: string
    user: WorkspaceShellUser
  }) => Promise<unknown>
  updateBillingPreferences?: (payload: {
    orgSlug: string
    preferences: BillingPreferences
    user: WorkspaceShellUser
  }) => Promise<BillingPreferences>
}

async function loadBillingOverview(input: {
  orgSlug: string
  user: WorkspaceShellUser
}) {
  await syncUserFromSession(input.user)
  const organization = await getOrganizationWorkspaceBySlug({
    orgSlug: input.orgSlug,
    userExternalId: input.user.id,
  })
  const overview = await getWorkspaceBillingOverview({
    organizationId: organization.id,
  })
  const billingConfigured = hasStripeBillingConfig()

  let invoices: Awaited<ReturnType<typeof listStripeInvoicesForCustomer>> = []
  let invoicesError: string | null = null
  let currentCycleSpendCents = 0
  let nextAutoReloadChargeCents: number | null = null

  if (billingConfigured && overview.customer) {
    const billingCycleWindow = getBillingCycleWindow({
      currentPeriodEnd: overview.subscription?.currentPeriodEnd ?? null,
      currentPeriodStart: overview.subscription?.currentPeriodStart ?? null,
    })
    const selectedTopUpPack = getAutoTopOffPacks().find(
      (pack) => pack.amountCents === overview.preferences.topOffAmountCents,
    )
    const shouldPreviewTopUp =
      overview.preferences.autoTopOffEnabled && selectedTopUpPack

    const [invoicesResult, spendResult, previewResult] =
      await Promise.allSettled([
        listStripeInvoicesForCustomer({
          stripeCustomerId: overview.customer.stripeCustomerId,
        }),
        getStripeBillingCycleSpendCents({
          periodEnd: billingCycleWindow.end,
          periodStart: billingCycleWindow.start,
          stripeCustomerId: overview.customer.stripeCustomerId,
        }),
        shouldPreviewTopUp
          ? previewStripeTopUpInvoiceCharge({
              stripeCustomerId: overview.customer.stripeCustomerId,
              topUpLookupKey: selectedTopUpPack.lookupKey,
            })
          : Promise.resolve(null),
      ])

    if (invoicesResult.status === "fulfilled") {
      invoices = invoicesResult.value
    } else {
      invoicesError =
        invoicesResult.reason instanceof Error
          ? invoicesResult.reason.message
          : "Invoice history is temporarily unavailable."
    }

    if (spendResult.status === "fulfilled") {
      currentCycleSpendCents = spendResult.value
    }

    if (previewResult.status === "fulfilled" && previewResult.value) {
      nextAutoReloadChargeCents = previewResult.value.amountDueCents
    }
  }

  return {
    ...overview,
    billingConfigured,
    currentCycleSpendCents,
    invoices,
    invoicesError,
    nextAutoReloadChargeCents,
  }
}

async function saveBillingPreferences(input: {
  orgSlug: string
  preferences: BillingPreferences
  user: WorkspaceShellUser
}) {
  await syncUserFromSession(input.user)
  const organization = await getOrganizationWorkspaceBySlug({
    orgSlug: input.orgSlug,
    userExternalId: input.user.id,
  })
  const preferences = await upsertBillingPreferences({
    organizationId: organization.id,
    preferences: input.preferences,
  })

  return preferences ?? input.preferences
}

async function startBillingCheckout(input: {
  body: z.infer<typeof billingCheckoutSchema>
  orgSlug: string
  user: WorkspaceShellUser
}) {
  await syncUserFromSession(input.user)
  const organization = await getOrganizationWorkspaceBySlug({
    orgSlug: input.orgSlug,
    userExternalId: input.user.id,
  })
  const plan = getBillingPlanByKey(input.body.planKey)

  if (!plan) {
    throw new Error("Unknown billing plan.")
  }

  const stripe = getStripe()
  const baseUrl = getApiEnv().PUBLIC_APP_BASE_URL

  let customer = await findBillingCustomerByOrganizationId(organization.id)

  if (!customer) {
    const stripeCustomer = await stripe.customers.create({
      email: input.user.email,
      metadata: {
        organization_external_id: organization.externalId,
        organization_id: organization.id,
        organization_slug: organization.slug,
      },
      name: organization.name,
    })

    customer = await upsertBillingCustomerRecord({
      defaultCurrency: stripeCustomer.currency,
      organizationId: organization.id,
      stripeCustomerId: stripeCustomer.id,
    })
  }

  if (!customer) {
    throw new Error("Failed to create or load the Stripe customer.")
  }

  const stripePriceId = await getStripeRecurringPriceIdForPlanKey(plan.key)
  const session = await stripe.checkout.sessions.create({
    cancel_url: `${baseUrl}/${organization.slug}/settings/workspace/billing?checkout=canceled`,
    client_reference_id: organization.id,
    customer: customer.stripeCustomerId,
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    metadata: {
      organization_id: organization.id,
      organization_slug: organization.slug,
      plan_key: plan.key,
    },
    mode: "subscription",
    payment_method_collection: "always",
    subscription_data: {
      metadata: {
        organization_id: organization.id,
        organization_slug: organization.slug,
        plan_key: plan.key,
      },
    },
    success_url: `${baseUrl}/${organization.slug}/settings/workspace/billing?checkout=success`,
  })

  await recordBillingCheckoutSession({
    checkoutUrl: session.url ?? null,
    mode: session.mode,
    organizationId: organization.id,
    planKey: plan.key,
    status: session.status ?? "open",
    stripeCheckoutSessionId: session.id,
    stripeCustomerId: customer.stripeCustomerId,
    stripeSubscriptionId:
      typeof session.subscription === "string" ? session.subscription : null,
  })

  return {
    url: session.url,
  }
}

async function openBillingPortal(input: {
  orgSlug: string
  user: WorkspaceShellUser
}) {
  await syncUserFromSession(input.user)
  const organization = await getOrganizationWorkspaceBySlug({
    orgSlug: input.orgSlug,
    userExternalId: input.user.id,
  })
  const customer = await findBillingCustomerByOrganizationId(organization.id)

  if (!customer) {
    const overview = await getWorkspaceBillingOverview({
      organizationId: organization.id,
    })

    if (!overview.subscription) {
      throw new Error(
        "This workspace does not have an active billing customer yet.",
      )
    }

    throw new Error("Billing customer state is missing for this workspace.")
  }

  const stripe = getStripe()
  const baseUrl = getApiEnv().PUBLIC_APP_BASE_URL
  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: `${baseUrl}/${organization.slug}/settings/workspace/billing`,
  })

  return {
    url: session.url,
  }
}

function createDefaultBillingRouteDependencies(): BillingRouteDependencies {
  return {
    authenticateWorkspaceUser: (request) =>
      authenticateWorkspaceSessionRequest({ request }),
    createBillingPortal: openBillingPortal,
    createCheckoutSession: startBillingCheckout,
    getBillingOverview: loadBillingOverview,
    updateBillingPreferences: saveBillingPreferences,
  }
}

export function createBillingRouter(
  dependencies: BillingRouteDependencies = createDefaultBillingRouteDependencies(),
) {
  const app = new Hono()

  async function authenticateUser(request: Request) {
    try {
      return {
        user: await (dependencies.authenticateWorkspaceUser
          ? dependencies.authenticateWorkspaceUser(request)
          : authenticateWorkspaceSessionRequest({ request })),
      } as const
    } catch (error) {
      if (isWorkspaceSessionAuthError(error)) {
        return {
          response: jsonNoStore(
            {
              code: error.code,
              message: error.message,
            },
            error.status,
          ),
        } as const
      }

      throw error
    }
  }

  return app
    .get(
      "/api/workspace/:orgSlug/billing/overview",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        return context.json(
          billingOverviewSchema.parse(
            await dependencies.getBillingOverview({
              orgSlug: context.req.valid("param").orgSlug,
              user: authResult.user,
            }),
          ),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/billing/preferences",
      zValidator("param", workspaceParamsSchema),
      zValidator("json", validatedBillingPreferencesSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        const preferences = await (dependencies.updateBillingPreferences ??
          saveBillingPreferences)({
          orgSlug: context.req.valid("param").orgSlug,
          preferences: context.req.valid("json"),
          user: authResult.user,
        })

        return context.json(
          billingPreferencesResponseSchema.parse({
            preferences,
          }),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/billing/checkout",
      zValidator("param", workspaceParamsSchema),
      zValidator("json", billingCheckoutSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        return context.json(
          billingUrlResponseSchema.parse(
            await (dependencies.createCheckoutSession ?? startBillingCheckout)({
              body: context.req.valid("json"),
              orgSlug: context.req.valid("param").orgSlug,
              user: authResult.user,
            }),
          ),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
    .post(
      "/api/workspace/:orgSlug/billing/portal",
      zValidator("param", workspaceParamsSchema),
      async (context) => {
        const authResult = await authenticateUser(context.req.raw)

        if ("response" in authResult) {
          return authResult.response
        }

        return context.json(
          billingUrlResponseSchema.parse(
            await (dependencies.createBillingPortal ?? openBillingPortal)({
              orgSlug: context.req.valid("param").orgSlug,
              user: authResult.user,
            }),
          ),
          200,
          {
            "Cache-Control": "no-store",
          },
        )
      },
    )
}

export function registerBillingRoutes(
  app: Hono,
  dependencies: BillingRouteDependencies = createDefaultBillingRouteDependencies(),
) {
  return app.route("/", createBillingRouter(dependencies))
}
