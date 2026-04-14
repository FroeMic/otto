import { buildManagedSkillMarkdown } from "../../markdown";
import type { SystemManagedSkillDefinition } from "../../system-skill-definition";

const NAMING_STRATEGIES_REFERENCE = `# Naming Strategies

Use multiple naming strategies in the same pass so founders get real variety instead of twenty near-duplicates.

## Strategy set

### Portmanteau

Blend two concepts at a natural overlap point.

- Best for: apps, consumer products, workflow tools
- Watch for: awkward joins and overstuffed syllables
- Example sources for a fintech like Ramp:
  - flow + ledger
  - spend + signal
  - margin + motion

### Invented words

Create a new word with clean phonetics and strong verbal distinctiveness.

- Best for: SaaS, infrastructure, AI, premium products
- Favor:
  - open vowels
  - 2 to 3 syllables
  - easy spelling after hearing it once
- Avoid:
  - dense consonant clusters
  - fake-Latin sludge
  - novelty spellings that need explanation

### Abstract or metaphorical

Use a real word with symbolic meaning rather than literal description.

- Best for: ambitious company brands
- Examples of strong categories:
  - motion
  - terrain
  - signal
  - craft
  - ascent

### Compound names

Join two complete words when fast comprehension matters.

- Best for: products that need immediate clarity
- Risk: sounding generic or overly functional

### Prefix and suffix variants

Use sparingly when the raw name is strong but the best domain is gone.

- Good prefixes:
  - use
  - get
  - go
  - try
  - with
  - join
- Good suffixes:
  - hq
  - app
  - labs
  - os
  - now
  - run

## Brandability heuristics

Score each candidate on:

- memorability
- pronounceability
- spellability
- uniqueness
- meaningfulness

Good defaults:

- 1 to 2 words
- ideally 2 to 3 syllables
- easy to say once and type correctly
- enough distinction from known companies in the category

## Domain heuristics

Domain quality matters, but it is one ranking input, not the whole decision.

Preferred order for startup use:

1. \`[name].com\`
2. \`[name].ai\`
3. \`[name].co\`
4. \`use[name].ai\` or \`get[name].co\`
5. \`[name].so\` or \`[name].inc\`

## International checks

Use web search to look for obvious conflicts, confusing brand overlap, and unintended meanings in target markets. At minimum check the target audience's main languages plus one broad sanity pass for Spanish, German, and Mandarin when the product is intended to travel internationally.
`;

const FULL_GUIDE_REFERENCE = `# Full Guide

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

For a strong candidate like \`ramp\`, check:

- \`ramp.com\`
- \`ramp.co\`
- \`ramp.io\`
- \`ramp.ai\`
- \`ramp.so\`
- \`ramp.inc\`
- \`ramp.org\`

### Step 2: interpret Gandi output

Return the full Gandi result, not just a flattened label.

- \`availability\`
  - coarse Otto bucket such as \`available\`, \`unavailable\`, \`pending\`, or \`unknown\`
- \`status\`
  - raw Gandi status such as \`available_reserved\`, \`unavailable_premium\`, or \`unavailable_restricted\`
- \`currentPhase\`
  - registration phase when present
- \`prices\`
  - enough detail to flag premium or constrained registration paths

### Step 3: rescue variants

If the raw name is unavailable, generate only high-signal variants such as:

- \`useramp.ai\`
- \`getramp.co\`
- \`goramp.so\`
- \`ramphq.com\`
- \`ramplabs.ai\`

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
`;

const SETUP_REFERENCE = `# Setup

## Required dependencies

- Brave web search
- Gandi integration

## Before using the skill

1. Confirm Brave is available for web search checks.
2. Confirm Gandi is enabled in the workspace.
3. If Gandi is disabled, enable it before running domain checks.

## Usage notes

- Use web search for competitive context, conflict checks, and meaning checks.
- Use Gandi for factual domain availability and registration metadata.
- Do not treat Gandi availability as legal clearance.
- If Gandi is unavailable, continue with a naming-only pass and state that domain facts are missing.
`;

function buildNameAndDomainResearchMarkdown() {
  return buildManagedSkillMarkdown({
    description:
      "Help founders generate, evaluate, and shortlist strong company names using web search plus live domain availability.",
    integrationKeys: ["brave", "gandi"],
    name: "Brand Name Generator",
    skillKeys: [],
    skillBody: `# Brand Name Generator

Generate creative, memorable, and brandable names for companies, products, apps, and startups. Use web search for market context and Gandi for domain facts.

## When to use

- the founder needs fresh company or product names
- a shortlist needs to be scored and narrowed
- domain availability should be checked before recommending finalists
- a near-miss name needs cleaner variants

## Dependencies

- \`brave\` for web search
- \`gandi\` for domain availability and registration metadata

## Workflow

1. Gather business context, audience, constraints, and preferred TLDs.
2. Generate 20 to 30 candidates across multiple naming strategies.
3. Score the strongest options for brandability.
4. Use Gandi batch checks on the top candidates.
5. If a strong name is unavailable, try a small set of high-quality variants.
6. Recommend the best 3 to 5 names with rationale and domain status details.

## Domain rules

- Check the raw name first before inventing variants.
- Prefer \`.com\`, then \`.ai\` or \`.co\` for startup use.
- Return both Otto's coarse \`availability\` bucket and Gandi's raw \`status\`.
- Include \`currentPhase\` and \`prices\` when present so premium or restricted cases are visible.

## Reference files

- open \`references/naming-strategies.md\` for strategy guidance
- open \`references/full-guide.md\` for the complete workflow and output shape
- open \`references/setup.md\` for dependency expectations
`,
  });
}

export const NAME_AND_DOMAIN_RESEARCH_SKILL_DEFINITION: SystemManagedSkillDefinition =
  {
    files: [
      {
        contentText: buildNameAndDomainResearchMarkdown(),
        path: "SKILL.md",
      },
      {
        contentText: NAMING_STRATEGIES_REFERENCE,
        path: "references/naming-strategies.md",
      },
      {
        contentText: FULL_GUIDE_REFERENCE,
        path: "references/full-guide.md",
      },
      {
        contentText: SETUP_REFERENCE,
        path: "references/setup.md",
      },
    ],
    skillKey: "name-and-domain-research",
    summary: "Install Otto system founder naming guidance",
  };
