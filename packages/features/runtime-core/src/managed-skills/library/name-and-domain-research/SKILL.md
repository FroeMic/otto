---
name: Brand Name Generator
description: Help founders generate, evaluate, and shortlist strong product, startup, company, and brand names using web search plus live domain availability.
metadata:
  dependsOn:
    integrations:
      - brave
      - gandi
    skills: []
---

# Brand Name Generator

Generate creative, memorable, and brandable names for products, startups, companies, and brands. Use web search for market context and Gandi for domain facts.

## When to use

- the founder needs fresh company or product names
- a shortlist needs to be scored and narrowed
- domain availability should be checked before recommending finalists
- a near-miss name needs cleaner variants

## Dependencies

- `brave` for web search
- `gandi` for domain availability and registration metadata

## Workflow

1. Gather business context, audience, constraints, and preferred TLDs.
2. Generate 20 to 30 candidates across multiple naming strategies.
3. Score the strongest options for brandability.
4. Use Gandi batch checks on the top candidates.
5. If a strong name is unavailable, try a small set of high-quality variants.
6. Recommend the best 3 to 5 names with rationale and domain status details.

## Domain rules

- Check the raw name first before inventing variants.
- Prefer `.com`, then `.ai` or `.co` for startup use.
- Return both Otto's coarse `availability` bucket and Gandi's raw `status`.
- Include `currentPhase` and `prices` when present so premium or restricted cases are visible.

## Reference files

- open `references/naming-strategies.md` for strategy guidance
- open `references/full-guide.md` for the complete workflow and output shape
- open `references/setup.md` for dependency expectations
- open `templates/recommendation-schema.json` for the structured output contract
- open `examples/ramp-shortlist.json` for a concrete example response
- run `scripts/generate-domain-variants.mjs <base-name>` for starter variant expansion
