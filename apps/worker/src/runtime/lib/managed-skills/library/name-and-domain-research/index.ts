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

const RECOMMENDATION_SCHEMA_TEMPLATE = `{
  "querySummary": {
    "businessConcept": "Expense automation for modern finance teams",
    "candidateCount": 10,
    "preferredTlds": ["com", "ai", "co"]
  },
  "recommendedNames": [
    {
      "name": "Ramp",
      "strategy": "abstract",
      "overallScore": 92,
      "verdict": "strong_candidate",
      "reasons": [
        "short and memorable",
        "clear upward-motion association",
        "credible startup brand voice"
      ],
      "brandability": {
        "memorability": 10,
        "pronounceability": 10,
        "spellability": 10,
        "uniqueness": 7,
        "meaningfulness": 9
      },
      "domainOptions": [
        {
          "domain": "ramp.com",
          "tld": "com",
          "availability": "unavailable",
          "status": "unavailable"
        },
        {
          "domain": "useramp.ai",
          "tld": "ai",
          "availability": "available",
          "status": "available"
        }
      ],
      "risks": ["exact-match .com unavailable"],
      "bestDomain": "useramp.ai"
    }
  ],
  "rejectedNames": [
    {
      "name": "Ramply",
      "reasons": [
        "weaker distinctiveness",
        "suffix feels forced",
        "domain path is less clean"
      ]
    }
  ]
}
`;

const RAMP_SHORTLIST_EXAMPLE = `{
  "querySummary": {
    "businessConcept": "Finance operations software",
    "candidateCount": 4,
    "preferredTlds": ["com", "ai", "co", "io"]
  },
  "recommendedNames": [
    {
      "name": "SignalMint",
      "strategy": "compound",
      "overallScore": 88,
      "verdict": "strong_candidate",
      "reasons": [
        "distinctive without being obscure",
        "clear finance and creation signal",
        "multiple clean domain paths"
      ],
      "brandability": {
        "memorability": 8,
        "pronounceability": 9,
        "spellability": 9,
        "uniqueness": 9,
        "meaningfulness": 8
      },
      "domainOptions": [
        {
          "domain": "signalmint.com",
          "tld": "com",
          "availability": "available",
          "status": "available"
        },
        {
          "domain": "signalmint.ai",
          "tld": "ai",
          "availability": "available",
          "status": "available"
        }
      ],
      "risks": [],
      "bestDomain": "signalmint.com"
    },
    {
      "name": "Ramp",
      "strategy": "abstract",
      "overallScore": 84,
      "verdict": "strong_but_operationally_constrained",
      "reasons": [
        "excellent brand quality",
        "instant recognition",
        "best exact domains already taken"
      ],
      "brandability": {
        "memorability": 10,
        "pronounceability": 10,
        "spellability": 10,
        "uniqueness": 7,
        "meaningfulness": 8
      },
      "domainOptions": [
        {
          "domain": "ramp.com",
          "tld": "com",
          "availability": "unavailable",
          "status": "unavailable"
        },
        {
          "domain": "useramp.ai",
          "tld": "ai",
          "availability": "available",
          "status": "available"
        }
      ],
      "risks": ["exact-match domain not realistically obtainable"],
      "bestDomain": "useramp.ai"
    }
  ],
  "rejectedNames": [
    {
      "name": "RampOpsify",
      "reasons": [
        "too long",
        "forced suffix pattern",
        "harder to say and remember"
      ]
    }
  ]
}
`;

const GENERATE_DOMAIN_VARIANTS_SCRIPT = `#!/usr/bin/env node
const prefixes = ["use", "get", "go", "try", "with", "join", "hey"];
const suffixes = ["hq", "app", "labs", "os", "now", "run"];
const defaultTlds = ["com", "co", "io", "ai", "so", "inc", "org"];

function normalizeBaseName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function expandDomainCandidates(baseName, tlds = defaultTlds) {
  const normalizedBaseName = normalizeBaseName(baseName);

  if (!normalizedBaseName) {
    throw new Error("Provide a non-empty base name.");
  }

  const names = new Set([normalizedBaseName]);

  for (const prefix of prefixes) {
    names.add(\`\${prefix}\${normalizedBaseName}\`);
  }

  for (const suffix of suffixes) {
    names.add(\`\${normalizedBaseName}\${suffix}\`);
  }

  const domains = [];

  for (const name of names) {
    for (const tld of tlds) {
      domains.push(\`\${name}.\${tld}\`);
    }
  }

  return domains;
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const [, , baseName, ...tlds] = process.argv;
  const domains = expandDomainCandidates(baseName ?? "", tlds.length > 0 ? tlds : defaultTlds);

  for (const domain of domains) {
    console.log(domain);
  }
}

export { expandDomainCandidates };
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
- open \`templates/recommendation-schema.json\` for the structured output contract
- open \`examples/ramp-shortlist.json\` for a concrete example response
- run \`scripts/generate-domain-variants.mjs <base-name>\` for starter variant expansion
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
        contentText: RAMP_SHORTLIST_EXAMPLE,
        path: "examples/ramp-shortlist.json",
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
      {
        contentText: GENERATE_DOMAIN_VARIANTS_SCRIPT,
        path: "scripts/generate-domain-variants.mjs",
      },
      {
        contentText: RECOMMENDATION_SCHEMA_TEMPLATE,
        path: "templates/recommendation-schema.json",
      },
    ],
    skillKey: "name-and-domain-research",
    summary: "Install Otto system founder naming guidance",
  };
