# TODO 03: Growth Pages And Content Expansion

## Goal

Expand the public site beyond the homepage only after the core conversion path and measurement baseline are working.

## Scope

- additional public pages
- lightweight content system choices
- SEO and comparison-page strategy
- future agent-assisted iteration surfaces

## Dependencies

- `TODO_02_posthog_measurement_and_experiments.md`

## Implementation notes

- Only add pages that have a clear measurement purpose.
- Prioritize pages that support conversion or trust:
  - deeper pricing
  - deeper security
  - enterprise contact surface
  - a small set of comparison pages
- Defer blog and changelog until there is a real publishing cadence.
- If a content system is introduced, keep it simple and file-based first unless there is a near-term editorial need that justifies more infrastructure.

## Acceptance criteria

- each new public page has a clear conversion or trust purpose
- page expansion does not erode the simplicity of the first-release homepage
- content additions reuse the same measurement model and design tokens

## Status checklist

- [ ] prioritize the next non-homepage route after v1 ships
- [ ] decide whether a file-based content model is sufficient
- [ ] define the first comparison-page template
- [ ] define enterprise contact or qualification flow if needed
- [ ] document SEO and internal-linking expectations

## Open questions

- Which second-wave pages actually change conversion behavior versus just adding surface area?
- At what point does the site need a CMS instead of a file-based system?
