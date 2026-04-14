# TODO 29: Name And Domain Research Workflow

## Goal

Plan the first user-facing slice that helps Otto evaluate startup names end to end by combining:

- naming heuristics
- domain availability checks
- domain quality scoring
- structured recommendations that higher-level workflows can use

This slice should stop short of DNS changes or domain purchase. Its purpose is to make Otto genuinely useful for startup naming work, not just expose a low-level registrar API.

## Scope

- define the first workflow that depends on the Phase 1 Gandi read surface
- specify the minimum command set and response shapes needed for startup-name evaluation
- define how Otto should discover and use those capabilities only when relevant
- define the first managed skill shape for name and domain research
- define the workspace enablement and agent interaction model for this workflow

## Explicit Non-Goals

- domain registration or checkout
- DNS writes
- automatic company naming without user input
- trademark or legal-clearance guarantees
- social-handle discovery beyond placeholder extension points
- broad marketing validation beyond the first name/domain lens

## Dependencies

- `TODO_29_gandi_domain_integration.md`
- `TODO_17_managed_integrations_architecture.md`
- `TODO_18_managed_skills.md`

## Product Intent

The first meaningful user outcome should be:

- a user gives Otto a company concept, product concept, or a shortlist of candidate names
- Otto evaluates name quality
- Otto checks likely domain options
- Otto ranks the candidates with concrete reasons
- Otto identifies promising available domains or near-miss alternatives

The result should feel like Otto can help make a naming decision, not merely report raw domain API output.

## Why This Needs A Separate Workflow Spec

The Gandi integration spec answers provider access and command exposure.

This spec answers:

- what Otto should actually do with that access
- which domain checks matter for startup naming
- what structure skills need from the integration responses
- how the first slice should be shaped so it produces good recommendations instead of noisy availability dumps

## First-Slice User Jobs

The workflow should support four concrete jobs:

### 1. Evaluate a shortlist

Example:

- "Compare these six startup names and tell me which ones are strongest."

Otto should:

- assess naming quality
- check obvious domain candidates
- rank the names
- explain tradeoffs

### 2. Expand from a seed concept

Example:

- "I want an AI operations assistant for finance teams. Suggest names with decent domain options."

Otto should:

- generate candidate names
- filter weak names quickly
- check domains for the stronger candidates
- return a shortlist with reasons

### 3. Rescue near-miss names

Example:

- "These names are good, but the `.com` domains are probably gone. Find viable alternatives."

Otto should:

- test suffixes, compounds, and close variants
- compare TLD options sensibly
- avoid low-quality spammy variations

### 4. Prepare a final recommendation set

Example:

- "Give me the top three names I could realistically use next week."

Otto should:

- favor names with clear, practical domain paths
- include confidence and caveats
- preserve the exact candidate domains checked

## First-Slice Output Contract

The workflow should return a structured recommendation set, not only prose.

Recommended top-level shape:

```json
{
  "querySummary": {
    "businessConcept": "AI operations assistant for finance teams",
    "candidateCount": 12
  },
  "recommendedNames": [
    {
      "name": "LedgerPilot",
      "overallScore": 86,
      "verdict": "strong_candidate",
      "reasons": [
        "clear business signal",
        "easy to pronounce",
        "usable domain variant available"
      ],
      "domainOptions": [
        {
          "domain": "ledgerpilot.com",
          "tld": "com",
          "availability": "unavailable"
        },
        {
          "domain": "ledgerpilot.ai",
          "tld": "ai",
          "availability": "available"
        }
      ],
      "risks": [
        "finance naming may feel narrower than broader operations positioning"
      ]
    }
  ],
  "rejectedNames": [
    {
      "name": "FinOpsly",
      "reasons": [
        "awkward pronunciation",
        "weaker brand quality",
        "best domain variants were poor"
      ]
    }
  ]
}
```

The exact schema may change, but the first slice should preserve these concepts:

- name-level scoring
- explicit domain options checked
- strengths
- risks
- clear recommendation status

## Required Integration Capabilities

The naming workflow only needs a subset of the broader Gandi plan.

Required commands for the first slice:

- `domain.check_availability`
- `domain.get_details`
- `domain.get_registration_metadata`

Recommended command additions specifically for naming quality:

- `domain.suggest_candidates`
  - optional provider-backed or Otto-computed helper, not required if Otto can derive variants itself
- `domain.batch_check`
  - preferred alias or optimized command for checking many candidate domains at once

The practical requirement is batching. Startup-name work often checks dozens of domains in one reasoning pass. The first slice should not force Otto into one-domain-at-a-time execution unless there is a hard provider limit.

## Domain Evaluation Model

The workflow should separate:

- name quality
- domain quality
- final practicality

### Name quality factors

- pronounceability
- memorability
- spelling clarity
- distinctiveness
- relevance to the business
- risk of generic or awkward construction

### Domain quality factors

- exact-match `.com` availability
- strong alternative TLD availability such as `.ai`, `.co`, `.io`, or `.dev` when appropriate
- length
- ambiguity in spelling
- hyphen or number penalties
- low-quality modifier or suffix penalties

### Practicality factors

- whether a founder could credibly launch with the available domain
- whether the best available option is good enough to recommend
- whether the name is attractive but operationally annoying

The final rank should not be determined by domain availability alone.

## Domain Search Strategy

The first slice should use a staged search strategy rather than brute force.

### Stage 1: canonical domain checks

For each candidate name, check:

- exact `.com`
- one or two context-appropriate priority TLDs

Default TLD preference:

1. `.com`
2. `.ai` for AI-native products
3. `.co`
4. `.io`
5. `.dev` for developer-facing products

This order should remain heuristic and overridable by the skill.

### Stage 2: sensible variants only

If the canonical domain is unavailable, try a constrained set of variants:

- add a strong business noun
- remove duplicated morphemes
- test a cleaner compound form
- test one or two short suffix patterns

Avoid:

- random prefixes
- long modifier chains
- numerals
- hyphenated fallbacks unless the user explicitly asks

### Stage 3: final recommendation filter

A candidate should only be recommended if:

- the name is strong enough
- at least one domain option is realistically usable

Otherwise Otto should explain why it is a near miss instead of forcing it into the final shortlist.

## Agent Workflow

Otto should use the integration only when the task is actually about startup naming or domains.

Recommended runtime flow:

1. detect naming or domain-evaluation intent
2. if Gandi is not enabled, ask to enable it through `manage_integration`
3. gather candidate names or generate them
4. compute candidate domain list locally
5. batch check domain availability
6. score and rank names
7. return a concise shortlist plus structured result payload

The workflow should avoid:

- checking domains before there is a plausible shortlist
- calling the integration for every weak brainstorm candidate
- treating TLD presence as the only recommendation signal

## Managed Skill Plan

The first workflow should eventually be packaged as a managed skill, for example:

- `name-and-domain-research`

That skill should teach Otto:

- when to use the Gandi integration
- how many domain candidates to check before narrowing
- which TLDs to prefer
- how to explain tradeoffs between a strong name and a weaker domain
- how to present near misses and alternatives

This skill should depend on:

- `gandi`

The skill should not own:

- integration enablement
- provider auth
- domain purchase

## Workspace UX Plan

The first workspace-facing surface does not need a full domain research product UI.

Minimum product requirement:

- the Gandi integration page clearly explains that it powers domain search and evaluation for Otto
- users can enable it for the workspace
- users understand Otto can use it for naming and launch-preparation workflows

Optional first-slice addition if useful:

- a lightweight domain research result renderer in workspace chat activity or future skill surfaces

## Recommended Implementation Sequence

### Step 1: tighten the Gandi Phase 1 command surface

Deliverables:

- batch-friendly domain check command
- normalized registration metadata contract
- integration discovery keywords aligned to naming workflows

Exit check:

- Otto can efficiently check multiple candidate domains in one task

### Step 2: define the name-evaluation contract

Deliverables:

- shared TypeScript schema for recommendation output
- scoring helpers for name quality, domain quality, and final recommendation state

Exit check:

- Otto can return a stable machine-usable result shape for naming workflows

### Step 3: add workflow orchestration and skill instructions

Deliverables:

- managed skill draft for name and domain research
- documented search strategy and recommendation heuristics

Exit check:

- Otto has explicit guidance on how to use the integration instead of improvising each run

### Step 4: expose enough UI and telemetry

Deliverables:

- workspace integration copy describing startup naming use cases
- activity/event labeling that makes domain checks understandable in the workspace

Exit check:

- users can understand what Otto checked and why

## Acceptance Criteria

- Otto can evaluate a shortlist of startup names and check the corresponding domains
- Otto can generate and evaluate plausible candidate names from a business concept
- Otto uses Gandi only when naming or domain evaluation is relevant
- the first slice checks domains in batches rather than one by one where possible
- results are returned as structured recommendations, not only prose
- the workflow favors practical launch-ready recommendations over raw brainstorm quantity
- the first slice remains read-only and does not depend on DNS write support

## Status Checklist

- [ ] define the startup-name evaluation output contract
- [ ] add batch-friendly Gandi domain-check capability
- [ ] define domain candidate expansion heuristics
- [ ] define ranking heuristics for names and domains
- [ ] draft the managed skill instructions for name and domain research
- [ ] align workspace integration copy with this workflow

## Open Questions

- Should the first slice score names numerically, categorically, or both?
- Should Otto check only the top one or two TLDs by default, or a slightly broader set for AI-native companies?
- Do we want domain suggestion generation to live inside the Gandi integration contract or stay entirely in the skill/workflow layer?
- Should social-handle availability be explicitly deferred from the first slice, or included as a placeholder concept in the result model?
