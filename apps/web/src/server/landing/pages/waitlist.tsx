import {
  type LandingHeaderViewer,
  LandingPageShell,
  LandingSection,
} from "../components/layout"

export interface LandingWaitlistPageProps {
  joined?: boolean
  prompt?: string
  viewer?: LandingHeaderViewer | null
}

export function LandingWaitlistPage({
  joined = false,
  prompt,
  viewer = null,
}: LandingWaitlistPageProps) {
  return (
    <LandingPageShell viewer={viewer}>
      <section className="border-b border-border/45 py-16 md:py-24">
        <LandingSection className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1fr)] lg:items-start">
          <div className="flex flex-col gap-5 pt-2">
            {joined ? (
              <p className="text-sm font-medium text-foreground">
                You are on the list.
              </p>
            ) : null}
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground text-balance md:text-6xl">
              Join the Waitlist
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Public account creation is paused while we bring teams in
              directly. Share a little context and we will follow up when your
              workspace is ready.
            </p>
          </div>

          <form
            action="/api/public/waitlist"
            className="flex flex-col gap-5 rounded-lg border border-border/70 bg-background p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
            method="post"
          >
            <WaitlistField
              autoComplete="name"
              label="Name"
              name="name"
              required
              type="text"
            />
            <WaitlistField
              autoComplete="email"
              label="Email"
              name="email"
              required
              spellCheck={false}
              type="email"
            />
            <WaitlistField
              autoComplete="organization"
              label="Company"
              name="company"
              required
              type="text"
            />
            <WaitlistTextArea
              defaultValue={prompt}
              label="What do you want to use the assistant for?"
              name="useCase"
              required
            />
            <WaitlistTextArea
              label="Where have you heard about us?"
              name="heardAbout"
              required
            />
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/92 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              type="submit"
            >
              Join the Waitlist
            </button>
          </form>
        </LandingSection>
      </section>
    </LandingPageShell>
  )
}

interface WaitlistFieldProps {
  autoComplete: string
  label: string
  name: string
  required?: boolean
  spellCheck?: boolean
  type: string
}

function WaitlistField({
  autoComplete,
  label,
  name,
  required = false,
  spellCheck,
  type,
}: WaitlistFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
      {label}
      <input
        autoComplete={autoComplete}
        className="min-h-11 rounded-lg border border-border/75 bg-background px-3 text-base font-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground/75 hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        name={name}
        required={required}
        spellCheck={spellCheck}
        type={type}
      />
    </label>
  )
}

interface WaitlistTextAreaProps {
  defaultValue?: string
  label: string
  name: string
  required?: boolean
}

function WaitlistTextArea({
  defaultValue,
  label,
  name,
  required = false,
}: WaitlistTextAreaProps) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
      {label}
      <textarea
        className="min-h-28 resize-y rounded-lg border border-border/75 bg-background px-3 py-2 text-base font-normal leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground/75 hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        defaultValue={defaultValue}
        name={name}
        required={required}
      />
    </label>
  )
}
