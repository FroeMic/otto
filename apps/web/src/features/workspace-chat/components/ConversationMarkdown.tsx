import { Streamdown } from "streamdown"

export interface ConversationMarkdownProps {
  children: string
  isStreaming: boolean
}

export function ConversationMarkdown({
  children,
  isStreaming,
}: ConversationMarkdownProps) {
  return (
    <Streamdown
      className="text-sm leading-7 text-foreground"
      disallowedElements={["img"]}
      isAnimating={isStreaming}
      linkSafety={{ enabled: true }}
      skipHtml
      unwrapDisallowed
    >
      {children}
    </Streamdown>
  )
}
