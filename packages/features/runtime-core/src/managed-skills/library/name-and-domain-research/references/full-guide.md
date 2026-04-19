# Full Guide

## Workflow

1. Gather context
2. Generate 20 to 30 candidates across at least 3 naming strategies
3. Score the strongest candidates for brandability
4. Check domains with Gandi
5. Rescue near-miss names with clean variants
6. Recommend the top 3 to 5 options with rationale

## Context checklist

- industry
- target audience
- brand personality
- constraints on length or tone
- preferred TLDs
- geographies and languages that matter
- names the founder already likes or dislikes
- budget sensitivity for premium domains

## Scoring guidance

Use a 1 to 10 score for:

- memorability
- pronounceability
- spellability
- uniqueness
- meaningfulness

Use the score to rank, but explain the tradeoff in words.

## Domain check workflow

### Step 1: raw name check

For a strong candidate like `ramp`, check:

- `ramp.com`
- `ramp.co`
- `ramp.io`
- `ramp.ai`
- `ramp.so`
- `ramp.inc`
- `ramp.org`

### Step 2: interpret Gandi output

Return the full Gandi result, not just a flattened label.

- `availability`
  - coarse Otto bucket such as `available`, `unavailable`, `pending`, or `unknown`
- `status`
  - raw Gandi status such as `available_reserved`, `unavailable_premium`, or `unavailable_restricted`
- `currentPhase`
  - registration phase when present
- `prices`
  - enough detail to flag premium or constrained registration paths

### Step 3: rescue variants

If the raw name is unavailable, generate only high-signal variants such as:

- `useramp.ai`
- `getramp.co`
- `goramp.so`
- `ramphq.com`
- `ramplabs.ai`

Avoid brute-force junk variants.

## Output shape

For each recommendation, provide:

- name
- naming strategy
- short rationale
- brandability scores
- best available domain
- other viable domain options
- Gandi availability status details
- competitive or linguistic cautions from web search

## Recommendation style

End with a short ranked shortlist:

1. strongest overall pick
2. best premium or aspirational pick
3. best fallback if the founder wants safer domain availability
