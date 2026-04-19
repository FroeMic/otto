---
name: Business Idea Onboarding
description: Friendly onboarding for new business ideas, side businesses, startup concepts, and existing companies that need Otto support. Use when the user shares a new business idea, asks Otto to help build or run a business, or enters a workspace with a starter prompt but no Business Profile yet.
metadata:
  dependsOn:
    integrations: []
    skills: []
---

# Business Idea Onboarding

Turn a new or existing business idea into durable project context Otto can reuse.

This is guided compression, not an accelerator application, survey, or strategy essay. Keep it short, leading, and useful. Work in short, conversational turns while onboarding; reflect what you understand, ask at most one focused question, then move toward writing or refreshing the Business Profile.

## When to use

Use this skill when:

- the user shares a new business idea
- the user says they want to build a startup, product, side business, agency, marketplace, internal tool, or AI product
- the user asks Otto to help build, validate, launch, operate, or run a business
- a starter prompt exists but no matching `projects/<project-key>/<project-key>.md` exists yet

Do not use this skill for narrow execution inside an already clear project. In that case, read the project files and continue with the requested work.

## Workflow

### Step 1: Read context before asking

Before asking the user for more, read relevant workspace context:

- `USER.md` for the user/team and past experience
- `MEMORY.md` for durable preferences and prior decisions
- `projects/_index.md` to avoid duplicating an existing project
- any matching Business Profile at `projects/<project-key>/<project-key>.md`
- linked supporting context under `projects/<project-key>/context/` when it exists and is relevant

If the project is clearly new, create a provisional project key and continue.

### Step 2: Lead with a tight reflection

Start with a short interpretation, not advice. Include:

- a one-sentence summary of the idea
- the likely customer or buyer, if visible
- what seems differentiated or uncertain
- the single biggest missing piece, if one exists

Classify the situation as `greenfield`, `brownfield`, or `unclear`.

### Step 3: Ask only what changes the recommendation

Ask at most one focused question per turn. Ask zero questions when the next recommendation is already clear.

Do not bundle a questionnaire. Do not ask for generic business-plan fields unless the answer will materially change the next step.

### Step 4: Create or update project files

Create the project folder if needed. Update `projects/_index.md`, the canonical Business Profile, and any immediately useful supporting context.

The canonical Business Profile lives at:

`projects/<project-key>/<project-key>.md`

Supporting context lives under:

`projects/<project-key>/context/`

Create `context/` only when writing the first supporting file. Do not create empty supporting files.

### Step 5: Route to one next move

End with a compact business frame and one recommended next move. The recommended next move must be singular and actionable. Prefer a move Otto can immediately help execute.

## Reference files

- open `references/project-structure.md` for the project file model and supporting context rules
- open `references/question-priorities.md` for the one-question priority order
- open `templates/business-profile.md` before writing a Business Profile
- open `templates/onboarding.md` before writing `context/onboarding.md`
- open `templates/roadmap.md` before writing `context/roadmap.md`
- open `examples/antique-books-marketplace.md` for an example of the expected output style

## Style

Follow the workspace's Otto personalization for tone. Be warm and direct. Avoid long questionnaires. Avoid startup theater. Preserve uncertainty instead of pretending the idea is clearer than it is.

Do not write consultant-style essays during onboarding. Do not list every possible strategy before establishing the project. Do not end with a pile of questions. Lead the user to the next concrete action.
