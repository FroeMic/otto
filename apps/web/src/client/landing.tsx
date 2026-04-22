import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { LandingPromptComposerClient } from "../server/landing/components/prompt-composer"
import {
  capturePostHogBrowserEvent,
  initPostHogBrowserAnalytics,
} from "./posthog"
import "./styles.css"

initPostHogBrowserAnalytics()

capturePostHogBrowserEvent("landing_view", {
  path: window.location.pathname,
})

const authModalRoot = document.querySelector<HTMLElement>(
  "[data-landing-auth-modal]",
)

if (authModalRoot) {
  capturePostHogBrowserEvent("landing_auth_modal_opened", {
    mode: authModalRoot.dataset.mode ?? "sign-up",
    path: window.location.pathname,
  })
}

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
