"use client"

import { hasUnconsumedStarterPrompt } from "@otto/feature-workspace-onboarding"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { startTransition } from "react"
import { toast } from "sonner"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  consumeWorkspaceOnboardingStarterPrompt,
  workspaceOnboardingQueryOptions,
} from "@/features/onboarding/api/onboarding"

import {
  createWorkspaceChatConversation,
  sendWorkspaceChatMessage,
  uploadWorkspaceChatAttachment,
} from "../api/chat"
import { WorkspaceAgentPromptCard } from "../components/WorkspaceAgentPromptCard"
import { WorkspaceChatPromptSuggestions } from "../components/WorkspaceChatPromptSuggestions"
import { useViewportDockBounds } from "../hooks/useViewportDockBounds"

export interface WorkspaceAgentPageProps {
  orgSlug: string
}

export function WorkspaceAgentPage({
  orgSlug,
}: WorkspaceAgentPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { boundsRef, dockStyle } = useViewportDockBounds()
  const { data: onboarding } = useSuspenseQuery(
    workspaceOnboardingQueryOptions(orgSlug),
  )
  const initialDraft = hasUnconsumedStarterPrompt({
    starterPrompt: onboarding.starterPrompt,
    starterPromptConsumedAt: onboarding.starterPromptConsumedAt
      ? new Date(onboarding.starterPromptConsumedAt)
      : null,
  })
    ? onboarding.starterPrompt ?? ""
    : ""
  const startConversationMutation = useMutation({
    mutationFn: async (input: {
      parts: Parameters<typeof sendWorkspaceChatMessage>[0]["parts"]
    }) => {
      const conversation = await createWorkspaceChatConversation({
        orgSlug,
      })

      startTransition(() => {
        void navigate({
          params: {
            conversationId: conversation.id,
            orgSlug,
          },
          to: "/$orgSlug/c/$conversationId",
        })
      })

      await sendWorkspaceChatMessage({
        clientMessageId: crypto.randomUUID(),
        conversationId: conversation.id,
        orgSlug,
        parts: input.parts,
      })

      if (initialDraft.trim().length > 0) {
        await consumeWorkspaceOnboardingStarterPrompt(orgSlug)
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-chat-conversations", orgSlug],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace-chat-conversation", orgSlug, conversation.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace-onboarding", orgSlug],
        }),
      ])
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start an agent conversation.",
      )
    },
  })
  async function startConversationFromText(text: string) {
    await startConversationMutation.mutateAsync({
      parts: [
        {
          text,
          type: "text",
        },
      ],
    })
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div
          aria-hidden
          className="mx-auto h-0 w-full max-w-3xl px-4"
          ref={boundsRef}
        />
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 pb-44 pt-14 text-center">
          <Empty className="border-0 p-0">
            <EmptyHeader className="max-w-2xl gap-3">
              <p className="text-sm font-medium tracking-[0.18em] text-primary/80 uppercase">
                Workspace conversation
              </p>
              <EmptyTitle className="text-4xl font-semibold text-foreground/94">
                Ask Otto to work through something in this workspace
              </EmptyTitle>
              <EmptyDescription className="max-w-xl text-base leading-8">
                Research, summarize, or take action. Pick a starting point or
                write your own message below.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="max-w-2xl">
              <WorkspaceChatPromptSuggestions
                disabled={startConversationMutation.isPending}
                onSelect={(prompt) => {
                  void startConversationFromText(prompt)
                }}
              />
            </EmptyContent>
          </Empty>
        </div>

        <div
          className="pointer-events-none fixed bottom-0 z-30"
          style={dockStyle}
        >
          <div className="pointer-events-auto w-full px-4 pb-5">
            <WorkspaceAgentPromptCard
              disabled={startConversationMutation.isPending}
              initialDraft={initialDraft}
              orgSlug={orgSlug}
              onSubmit={async (input) => {
                await startConversationMutation.mutateAsync(input)
              }}
              onUploadAttachment={async (file) => {
                return await uploadWorkspaceChatAttachment({
                  file,
                  orgSlug,
                })
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
