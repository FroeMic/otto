# feature-billing

Plan definitions, Zod schemas, and TypeScript types for the billing surface. Shared across `apps/api`, `apps/worker`, and `apps/web`.

## Plan Tiers

| Plan | Credits / month | Price / month |
|---|---|---|
| Free | 1,000 | $0 |
| Basic | 10,000 | $20 |
| Plus | 30,000 | $50 |
| Pro | 70,000 | $100 |
| Max | 150,000 | $200 |

## Key Concepts

- **Credits** are the internal unit of account. All usage is denominated in credits regardless of which model was used.
- **Token → credit conversion** happens in `apps/worker` via the `settle_credit_usage_chunk` job, which reads OpenAI usage records and writes to the credit ledger.
- **Auto top-off** — tenants can configure a minimum credit balance that triggers an automatic Stripe charge to replenish.
- **Monthly spend cap** — configurable ceiling to prevent runaway costs.

## Key Exports

```ts
BILLING_PLAN_KEYS         // plan key constants
BILLING_PAID_PLAN_DEFINITIONS  // plan definitions with credits and price
FREE_PLAN_CREDITS         // 1_000

billingOverviewSchema     // current balance, plan, usage summary
billingPreferencesSchema  // auto top-off and spend cap settings
```
