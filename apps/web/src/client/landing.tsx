import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"

import { LandingPromptComposerClient } from "../server/landing/components/prompt-composer"
import "./styles.css"

const promptComposerRoots = document.querySelectorAll<HTMLElement>(
  "[data-landing-prompt-composer]",
)

for (const root of promptComposerRoots) {
  hydrateRoot(
    root,
    <StrictMode>
      <LandingPromptComposerClient
        examplesHeading={root.dataset.examplesHeading}
        prompt={root.dataset.prompt}
        returnTo={root.dataset.returnTo}
      />
    </StrictMode>,
  )
}
