# Project Structure

Each serious business idea, company, product, or evaluation thread is one project.

Project context lives under:

`projects/<project-key>/`

The workspace project registry lives at:

`projects/PROJECTS.md`

The canonical Business Profile lives at:

`projects/<project-key>/<project-key>.md`

Repeat the project key in the filename so grep/find can discover Business Profiles directly. This should be the only required root-level file in a project folder.

Supporting context lives under:

`projects/<project-key>/context/`

Create `context/` only when writing the first supporting file. Do not create empty supporting files.

Use a short, stable, lowercase project key like `dentalops-ai`, `creator-crm`, or `agency-productization`.

If the idea appears related to an existing project, ask whether to use that project or create a new one.

## Project registry

Update `projects/PROJECTS.md` with:

- project key
- working name
- one-liner
- status: greenfield, brownfield, or unclear
- current focus
- path: `projects/<project-key>/<project-key>.md`

## Supporting context files

Create or update `projects/<project-key>/context/onboarding.md` when capturing the original prompt, intake answers, assumptions, unresolved questions, or a session note.

Create `projects/<project-key>/context/roadmap.md` when the onboarding conversation produces a real lightweight plan or concrete next steps.

Other optional supporting context files belong under `projects/<project-key>/context/`:

- `decisions.md`: important decisions and why they were made
- `experiments.md`: validation tests, outcomes, and learnings
- `research.md`: customer, market, competitor, supplier, or sourcing notes
- `economics.md`: pricing, margins, costs, break-even, and financial model notes
- `operations.md`: workflows, staffing, tools, compliance, vendors, and fulfillment

Do not create `goals.md`, `experiments.md`, `decisions.md`, or other files unless they are immediately useful for the conversation. Do not create empty supporting files.
