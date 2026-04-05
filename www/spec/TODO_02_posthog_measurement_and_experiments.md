# TODO 02: PostHog Measurement And Experiments

## Goal

Instrument the public site so Otto can run safe, measurable landing-page experiments on the same PostHog project as the workspace app.

## Scope

- PostHog setup for the `www/` app
- visitor and session attribution between public site and workspace signup
- event taxonomy for landing-page conversion
- initial experiment surfaces
- guardrails for automated or agent-driven iteration

## Dependencies

- `TODO_00_www_foundation_and_theme.md`
- `TODO_01_homepage_information_architecture.md`

## Implementation notes

- Use the same PostHog project as the workspace app so top-of-funnel and signup behavior can be tied together.
- Distinguish sources with explicit properties such as:
  - `app_name: "www"`
  - `entry_path`
  - `cta_variant`
  - `persona_hint`
- Start with a small event model:
  - `landing_page_viewed`
  - `landing_primary_cta_clicked`
  - `pricing_page_viewed`
  - `security_page_viewed`
  - `signup_started`
  - `signup_completed`
- Keep one primary experiment metric at a time.
- Treat performance and UX regressions as guardrails, not afterthoughts.
- An agent-driven optimization loop should begin in recommendation mode before it is allowed to ship changes automatically.

## Initial experiment recommendations

- hero headline framing
- hero supporting copy length
- primary CTA label
- screenshot ordering or density
- proof-strip composition

## Suggested starter metrics

- Primary:
  - signup start rate per unique landing visitor
- Secondary:
  - signup completion rate
  - primary CTA click-through rate
  - pricing-page assist rate
  - qualified contact rate if a demo path exists
- Guardrails:
  - mobile conversion rate
  - bounce or sub-10-second exit rate
  - LCP and INP by variant
  - obvious confusion signals from session replay samples

## Acceptance criteria

- PostHog runs in `www/`
- anonymous visitors and authenticated signup starts can be connected well enough for funnel analysis
- at least one homepage experiment can be launched without code churn in unrelated areas
- dashboards exist for the primary conversion funnel and guardrail metrics
- the optimization loop is documented with human review before auto-ship

## Status checklist

- [ ] define event taxonomy
- [ ] define shared attribution strategy between `www/` and `web/`
- [ ] instrument homepage and supporting pages
- [ ] instrument signup start and completion funnel joins
- [ ] configure first experiment
- [ ] create a dashboard for the funnel and guardrails
- [ ] document a safe agent workflow for experiment suggestions and rollout

## Open questions

- Can the existing signup flow expose enough attribution context back into PostHog without modifying auth flow complexity too early?
- Should the first experiment be anonymous-visitor only, or should it optimize for downstream signup completion once attribution is stable?
- What approval threshold is required before an agent can publish a variant automatically?
