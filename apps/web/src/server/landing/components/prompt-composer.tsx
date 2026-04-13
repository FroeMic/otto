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
    <div className={cn("flex w-full max-w-4xl flex-col gap-5", className)}>
      <form
        action="/login"
        className="rounded-[2rem] border border-border/65 bg-background/92 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur"
        method="get"
      >
        <input name="returnTo" type="hidden" value={returnTo} />
        <div className="flex flex-col gap-4">
          <textarea
            className="min-h-[150px] w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground/85"
            defaultValue={prompt}
            name="prompt"
            placeholder="Tell Otto about the software business you want to start or run..."
          />

          <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-3">
            <p className="text-sm text-muted-foreground">
              Start with the business problem. Otto can qualify and guide the
              next step from there.
            </p>
            <button
              className={cn(buttonVariants({ size: "lg" }), "shrink-0")}
              type="submit"
            >
              Get started
            </button>
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {examplesHeading}
        </p>
        <div className="flex flex-wrap gap-3">
          {landingExamplePrompts.map((examplePrompt) => (
            <a
              className="inline-flex rounded-full border border-border/65 bg-background/80 px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
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
