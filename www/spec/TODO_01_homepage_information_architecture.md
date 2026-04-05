# TODO 01: Homepage Information Architecture

## Goal

Define and ship the minimal homepage that can plausibly convert a prosumer visitor without trying to explain every edge of the product.

## Scope

- homepage section order
- first-release copy scope
- first-release imagery and product-visual strategy
- responsive layout and dark-mode treatment
- supporting routes needed for credibility

## Dependencies

- `TODO_00_www_foundation_and_theme.md`

## Implementation notes

- Keep the homepage opinionated and concise.
- Optimize for prosumers who want to understand product shape quickly.
- Favor real product visuals, screenshots, and controlled mockups over abstract illustration-only sections.
- Use shadcn as the structural base and selectively use Magic UI blocks where they accelerate polish without locking the site into hard-to-maintain markup.
- Keep section count low in v1. A good starting shape:
  - hero with product visual and primary CTA
  - proof strip or concise trust row
  - "what Otto does" section with 3 to 4 concrete capabilities
  - product preview section with screenshots or device frames
  - simple pricing summary
  - security reassurance block
  - final CTA
- Avoid large comparison, blog, changelog, and enterprise content in the first release.

## Acceptance criteria

- the homepage explains Otto in one pass without requiring secondary pages
- the design feels aligned with the current Otto brand:
  - warm orange accents
  - soft surfaces
  - rounded geometry
  - polished in both light and dark mode
- the homepage has one clearly dominant CTA
- the page includes enough product imagery to feel tangible
- supporting routes exist for at least pricing and security if the nav exposes them

## Status checklist

- [ ] define the homepage section order
- [ ] define the first-release nav
- [ ] write concise hero and value-prop copy
- [ ] choose screenshot vs mockup strategy for product visuals
- [ ] decide which Magic UI blocks are acceptable accelerators
- [ ] define the minimum pricing-page content
- [ ] define the minimum security-page content
- [ ] verify mobile layout quality and dark-mode quality

## Open questions

- What is the most accurate short positioning line for Otto right now?
- Which screenshots can be shown publicly without creating promise debt against unfinished product areas?
- Is the first trust block based on integrations, security posture, or workflow outcomes?
