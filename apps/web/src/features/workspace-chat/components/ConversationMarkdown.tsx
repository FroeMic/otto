import { Streamdown } from "streamdown"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import { useMemo } from "react"

export interface ConversationMarkdownProps {
  baseUrl?: string
  children: string
  isStreaming: boolean
  orgSlug?: string
}

export function ConversationMarkdown({
  baseUrl,
  children,
  isStreaming,
  orgSlug,
}: ConversationMarkdownProps) {
  const components = useMemo(
    () => ({
      a: ({
        children: linkChildren,
        href,
        node: _node,
        ...anchorProps
      }: ConversationMarkdownAnchorProps) => {
        const linkTarget = resolveWorkspaceChatMarkdownLinkTarget({
          baseUrl: baseUrl ?? getCurrentBaseUrl(),
          href,
          orgSlug,
        })

        return (
          <a
            {...anchorProps}
            href={linkTarget.href}
            rel={
              linkTarget.isInternalWorkspaceLink ? undefined : "noreferrer"
            }
            target={linkTarget.isInternalWorkspaceLink ? undefined : "_blank"}
          >
            {linkChildren}
          </a>
        )
      },
    }),
    [baseUrl, orgSlug],
  )

  return (
    <Streamdown
      className="text-sm leading-5 text-foreground [&_[data-streamdown=code-block]]:my-0 [&_[data-streamdown=code-block]]:rounded-none [&_[data-streamdown=code-block]]:border-0 [&_[data-streamdown=code-block]]:bg-transparent [&_[data-streamdown=code-block]]:p-0"
      components={components}
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

interface ConversationMarkdownAnchorProps
  extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: ReactNode
  node?: unknown
}

export function resolveWorkspaceChatMarkdownLinkTarget(input: {
  baseUrl?: string
  href?: string
  orgSlug?: string
}) {
  const href = input.href ?? ""
  const orgSlug = input.orgSlug?.trim().replace(/^\/+|\/+$/g, "")

  if (!href || !orgSlug) {
    return {
      href,
      isInternalWorkspaceLink: false,
    }
  }

  try {
    const baseUrl = input.baseUrl
    const url = baseUrl
      ? new URL(href, baseUrl)
      : href.startsWith("/")
        ? new URL(href, "https://workspace.local")
        : null

    if (!url) {
      return {
        href,
        isInternalWorkspaceLink: false,
      }
    }

    const sameOrigin = baseUrl
      ? url.origin === new URL(baseUrl).origin
      : href.startsWith("/")
    const workspacePath = `/${orgSlug}`
    const isWorkspacePath =
      url.pathname === workspacePath ||
      url.pathname.startsWith(`${workspacePath}/`)

    return {
      href,
      isInternalWorkspaceLink: sameOrigin && isWorkspacePath,
    }
  } catch {
    return {
      href,
      isInternalWorkspaceLink: false,
    }
  }
}

function getCurrentBaseUrl() {
  if (typeof window === "undefined") {
    return undefined
  }

  return window.location.origin
}
