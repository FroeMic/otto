import { buttonVariants } from "@/shared/button-variants"
import { cn } from "@/shared/cn"

import { landingExamplePrompts } from "../content/home"

export interface LandingPromptComposerProps {
  className?: string
  examplesHeading?: string
  prompt?: string
  returnTo?: string
}

export function LandingPromptComposer({
  className,
  examplesHeading = "Try one of these",
  prompt,
  returnTo = "/",
}: LandingPromptComposerProps) {
  return (
    <div
      className={cn("mx-auto flex w-full max-w-4xl flex-col gap-4", className)}
    >
      <form
        action="/login"
        className="rounded-xl border border-border/70 bg-background p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
        method="get"
      >
        <input name="returnTo" type="hidden" value={returnTo} />
        <div className="flex flex-col gap-4">
          <textarea
            className="min-h-[148px] w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground/85"
            defaultValue={prompt}
            name="prompt"
            placeholder="Describe the software business you want to launch or run..."
          />

          <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-3">
            <p className="max-w-2xl text-sm text-muted-foreground">
              Describe the business you are trying to run. Otto will qualify the
              next step.
            </p>
            <button
              className={cn(
                buttonVariants({ size: "lg" }),
                "shrink-0 rounded-full bg-foreground text-background shadow-none hover:bg-foreground/92",
              )}
              type="submit"
            >
              Get started
            </button>
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-3 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {examplesHeading}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {landingExamplePrompts.map((examplePrompt) => (
            <a
              className="inline-flex rounded-full border border-border/70 bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
              href={`/?prompt=${encodeURIComponent(examplePrompt)}#start`}
              key={examplePrompt}
            >
              {examplePrompt}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
