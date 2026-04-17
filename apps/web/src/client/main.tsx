import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { AppProviders } from "./app/AppProviders"
import { router } from "./app/router"
import { initPostHogBrowserAnalytics } from "./posthog"
import "./styles.css"

const container = document.getElementById("root")

if (!container) {
  throw new Error("Root container #root was not found.")
}

initPostHogBrowserAnalytics()

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
