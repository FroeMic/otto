---
name: Business Onboarding
description: Friendly onboarding for new business ideas, side businesses, startup concepts, and existing companies that need Otto support. Use when the user shares a new business idea, asks Otto to help build or run a business, or enters a workspace with a starter prompt but no Business Profile yet.
metadata:
  dependsOn:
    integrations: []
    skills: []
---

# Business Onboarding

Turn a new or existing business idea into a durable Business Profile Otto can reuse.

This is guided compression, not an accelerator application, survey, or strategy essay. Keep it short, leading, and useful. Work in short, conversational turns while onboarding; reflect what you understand, ask at most one focused question, then move toward writing or refreshing the Business Profile.

## Goal

By the end, Otto should know:

- what the user wants to build or improve
- whether this is greenfield, brownfield, or unclear
- who the first customer or user appears to be
- what exists already
- how the user wants Otto to help first
- which next action, roadmap item, or skill should run

The user should not have to push the conversation forward. Otto should absorb existing context, reflect the idea back conversationally, ask only the highest-value missing question, and move toward a concrete next action.

## When to use

Use this skill when:

- the user shares a new business idea
- the user says they want to build a startup, product, side business, agency, marketplace, internal tool, or AI product
- the user asks Otto to help build, validate, launch, operate, or run a business
- a starter prompt exists but no matching `projects/<project-key>/<project-key>.md` exists yet

Do not use this skill for narrow execution inside an already clear project. In that case, read the project files and continue with the requested work.

## Project model

Each serious business idea, company, product, or evaluation thread is one project.

Project context lives under:

`projects/<project-key>/`

The workspace project registry lives at:

`projects/_index.md`

The canonical Business Profile lives at:

`projects/<project-key>/<project-key>.md`

Repeat the project key in the filename so grep/find can discover Business Profiles directly. This should be the only required root-level file in a project folder.

Supporting context lives under:

`projects/<project-key>/context/`

Create `context/` only when writing the first supporting file. Do not create empty supporting files.

Use a short, stable, lowercase project key like `dentalops-ai`, `creator-crm`, or `agency-productization`.

If the idea appears related to an existing project, ask whether to use that project or create a new one.

## Workflow

### Step 1: Read context before asking

Before asking the user for more, read the relevant workspace context:

- `USER.md` for the user/team and past experience
- `MEMORY.md` for durable preferences and prior decisions
- `projects/_index.md` to avoid duplicating an existing project
- any matching Business Profile at `projects/<project-key>/<project-key>.md`
- any linked supporting context under `projects/<project-key>/context/` when it exists and is relevant

If the project is clearly new, create a provisional project key and continue.

### Step 2: Lead with a tight reflection

Start with a short interpretation, not advice. Include:

- a one-sentence summary of the idea
- the likely customer or buyer, if visible
- what seems differentiated or uncertain
- the single biggest missing piece, if one exists

Classify the situation:

- `greenfield`: new idea, early exploration, no meaningful operating history yet
- `brownfield`: existing business, product, team, customers, revenue, audience, codebase, or active operations
- `unclear`: not enough context yet

### Step 3: Ask only what changes the recommendation

Ask at most one focused question per turn. Ask zero questions when the next recommendation is already clear.

Do not bundle a questionnaire. Do not ask for generic business-plan fields unless the answer will materially change the next step.

Priority order for the one question:

1. who the first buyer or user is
2. what they do today instead
3. what already exists: team, code, audience, customers, revenue, distribution, domain, or assets
4. what Otto should help produce next
5. what would make the next 30 days a win

For brownfield projects, prioritize existing customers, revenue model, team, current tools, constraints, and what must not break.

For greenfield projects, prioritize first customer, pain, current conviction, first offer, and first validation move.

### Step 4: Create or update the Business Profile

Create the project folder if needed.

Update `projects/_index.md` with:

- project key
- working name
- one-liner
- status: greenfield, brownfield, or unclear
- current focus
- path: `projects/<project-key>/<project-key>.md`

Create or update `projects/<project-key>/<project-key>.md` as the canonical Business Profile using this shape. Adapt section labels lightly to the business type, but preserve each section's function.

```markdown
# Business Profile: <Name>

Updated: <YYYY-MM-DD>

## Current Read
<A compact analyst brief in 5-8 sentences. Distill the useful judgment from everything known so far: what matters, what changed, what is still uncertain, and what tension should not be flattened. This is not a transcript.>

## One-Liner
...

## Situation
Greenfield / Brownfield / Unclear

## Current Thesis
...

## Customer / User / Buyer / Guest
...

## Need / Occasion / Existing Alternatives
...

## Offer / Positioning
...

## Evidence And Source Notes
- ...
- ...

## Contradictions And Tensions
- ...
- ...

## Assets And Constraints
...

## Confidence And Unknowns
...

## Current Focus
...

## Next Recommended Move
...

## Supporting Context
- [Onboarding](context/onboarding.md) - original prompt, intake answers, assumptions, and unresolved questions.
- [Roadmap](context/roadmap.md) - lightweight plan, current phase, next steps, milestones, blockers.
```

Only include `Supporting Context` links for files that exist or that you create in the same turn.

Create or update `projects/<project-key>/context/onboarding.md` with:

```markdown
# Onboarding

## Original Prompt
...

## Answers Gathered
...

## Assumptions
...

## Unresolved Questions
...

## Session Note
...
```

Create `projects/<project-key>/context/roadmap.md` when the onboarding conversation produces a real lightweight plan or concrete next steps:

```markdown
# Roadmap

Updated: <YYYY-MM-DD>

## Current Phase
Discovery / Validation / Setup / Launch / Operations / Growth / Unknown

## Goal
...

## Next Steps
1. ...
2. ...
3. ...

## Milestones
- [ ] ...

## Open Decisions
- ...

## Blockers / Risks
- ...

## Done Recently
- ...
```

Other optional supporting context files belong under `projects/<project-key>/context/`:

- `decisions.md`: important decisions and why they were made
- `experiments.md`: validation tests, outcomes, and learnings
- `research.md`: customer, market, competitor, supplier, or sourcing notes
- `economics.md`: pricing, margins, costs, break-even, and financial model notes
- `operations.md`: workflows, staffing, tools, compliance, vendors, and fulfillment

Do not create `goals.md`, `experiments.md`, `decisions.md`, or other files unless they are immediately useful for the conversation. Do not create empty supporting files.

### Step 5: Route to one next move

End with a compact business frame and one recommended next move.

Use this shape:

```markdown
## Current Read

- Idea: ...
- Customer: ...
- Offer: ...
- Differentiation: ...
- Biggest unknown: ...
- One recommended next move: ...
```

The recommended next move must be singular and actionable. Prefer a move Otto can immediately help execute:

- define the MVP
- define the first customer segment
- define the landing-page pitch
- define pricing and packaging
- define a validation plan
- identify first seller/customer targets
- draft outreach

Good routing defaults:

- Use `dream-big` when the user has a raw idea and wants to shape ambition, narrative, or endgame.
- Use first-segment or customer-discovery work when the user wants validation or a first customer.
- Use offer or landing-page work when the target user and pain are clear enough to present externally.
- Use goals or operating-rhythm work when the project already exists and needs focus.
- Use experiments or review work when prior attempts need to be logged, compared, or improved.

## Style

Follow the workspace's Otto personalization for tone. Be warm and direct. Avoid long questionnaires. Avoid startup theater. Preserve uncertainty instead of pretending the idea is clearer than it is.

Do not write consultant-style essays during onboarding. Do not list every possible strategy before establishing the project. Do not end with a pile of questions. Lead the user to the next concrete action.
