import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import type { PropsWithChildren } from "react"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import { ShellNotificationProvider } from "./app-shell/notifications/ShellNotificationProvider"
import { queryClient } from "./router"

export interface AppProvidersProps extends PropsWithChildren {}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <QueryClientProvider client={queryClient}>
        <ShellNotificationProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ShellNotificationProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
