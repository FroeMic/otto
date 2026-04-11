import { useEffect } from "react"

import { useWorkspaceChatRealtimeContext } from "./provider"

export interface UseWorkspaceConversationRealtimeInput {
  conversationId: string
}

export function useWorkspaceConversationRealtime(
  input: UseWorkspaceConversationRealtimeInput,
) {
  const realtime = useWorkspaceChatRealtimeContext()

  useEffect(() => {
    realtime.subscribeConversation(input.conversationId)

    return () => {
      realtime.unsubscribeConversation(input.conversationId)
    }
  }, [input.conversationId, realtime])
}
