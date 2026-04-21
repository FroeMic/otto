"use client"

import { MagicWandIcon, PlusIcon } from "@phosphor-icons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { RainbowButton } from "@/components/ui/rainbow-button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { startAgentPersonalizationOnboarding } from "@/features/workspace-chat/api/chat"
import { ConversationHistorySection } from "@/features/workspace-chat/sidebar/ConversationHistorySection"

import { WorkspacePrimaryNav } from "./WorkspacePrimaryNav"
import { WorkspaceSwitcher } from "./WorkspaceSwitcher"
import {
  WorkspaceFooterPlatformLink,
  WorkspaceUserMenu,
} from "./WorkspaceUserMenu"

export interface WorkspaceSidebarProps {
  currentOrganization: {
    agentPersonalizedAt: string | null
    name: string
    slug: string
  }
  organizations: Array<{
    name: string
    slug: string
  }>
  orgSlug: string
  user: {
    email: string
    id: string
    isPlatformAdmin: boolean
    name: string
  }
}

export function WorkspaceSidebar({
  currentOrganization,
  organizations,
  orgSlug,
  user,
}: WorkspaceSidebarProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const startPersonalizationMutation = useMutation({
    mutationFn: async () => {
      return await startAgentPersonalizationOnboarding({ orgSlug })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start personalization.",
      )
    },
    onSuccess: async (conversation) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["shell-bootstrap", orgSlug],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace-chat-conversations", orgSlug],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace-chat-conversation", orgSlug, conversation.id],
        }),
      ])
      await navigate({
        params: {
          conversationId: conversation.id,
          orgSlug,
        },
        to: "/$orgSlug/c/$conversationId",
      })
    },
  })

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="shrink-0 gap-2 pb-2">
        <div className="flex items-center justify-between gap-2 pt-2">
          <WorkspaceSwitcher
            className="min-w-0 max-w-[calc(100%-2.75rem)]"
            currentOrganization={currentOrganization}
            organizations={organizations}
          />
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full border-sidebar-border bg-sidebar hover:bg-sidebar-accent hover:text-sidebar-accent-foreground size-7"
            render={
              <Link params={{ orgSlug }} preload="intent" to="/$orgSlug" />
            }
            aria-label="Open agent"
            title="Open agent"
          >
            <PlusIcon />
          </Button>
        </div>
        <WorkspacePrimaryNav orgSlug={orgSlug} />
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 overflow-hidden gap-0 px-0">
        <ConversationHistorySection orgSlug={orgSlug} />
      </SidebarContent>

      <SidebarFooter className="shrink-0 border-t border-sidebar-border/70 pt-3">
        {currentOrganization.agentPersonalizedAt ? null : (
          <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
            <RainbowButton
              className="h-10 w-full rounded-full text-sm shadow-sm"
              disabled={startPersonalizationMutation.isPending}
              onClick={() => {
                startPersonalizationMutation.mutate()
              }}
              type="button"
            >
              <MagicWandIcon weight="bold" />
              <span>Personalize Otto</span>
            </RainbowButton>
          </div>
        )}
        {user.isPlatformAdmin ? (
          <WorkspaceFooterPlatformLink orgSlug={orgSlug} />
        ) : null}
        <WorkspaceUserMenu currentOrganizationSlug={orgSlug} user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
