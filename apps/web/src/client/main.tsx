import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { AppProviders } from "./app/AppProviders"
import { router } from "./app/router"
import "./styles.css"

const rootElement = document.getElementById("root")

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <AppProviders>
          <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
}
