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
      className="text-sm leading-5 text-foreground [&_[data-streamdown=code-block]]:my-0 [&_[data-streamdown=code-block]]:rounded-none [&_[data-streamdown=code-block]]:border-0 [&_[data-streamdown=code-block]]:bg-transparent [&_[data-streamdown=code-block]]:p-0"
      disallowedElements={["img"]}
      isAnimating={isStreaming}
      linkSafety={{ enabled: false }}
      skipHtml
      unwrapDisallowed
    >
      {children}
    </Streamdown>
  )
}
