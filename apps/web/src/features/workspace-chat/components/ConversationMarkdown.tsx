import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface ConversationMarkdownProps {
  className?: string
  text: string
}

type MarkdownBlock =
  | {
      kind: "code"
      language?: string
      text: string
    }
  | {
      kind: "heading"
      level: 2 | 3 | 4
      text: string
    }
  | {
      kind: "list"
      ordered: boolean
      items: string[]
    }
  | {
      kind: "paragraph"
      text: string
    }
  | {
      kind: "quote"
      lines: string[]
    }

export function ConversationMarkdown({
  className,
  text,
}: ConversationMarkdownProps) {
  const blocks = parseMarkdownBlocks(text)

  return (
    <div className={cn("space-y-3 text-sm leading-7 text-foreground", className)}>
      {blocks.map((block, index) => (
        <MarkdownBlockView
          block={block}
          key={`${block.kind}:${index}`}
        />
      ))}
    </div>
  )
}

interface MarkdownBlockViewProps {
  block: MarkdownBlock
}

function MarkdownBlockView({ block }: MarkdownBlockViewProps) {
  if (block.kind === "heading") {
    const Heading = block.level === 2 ? "h2" : block.level === 3 ? "h3" : "h4"

    return (
      <Heading className="pt-1 font-semibold leading-7 text-foreground">
        {renderInlineMarkdown(block.text)}
      </Heading>
    )
  }

  if (block.kind === "list") {
    const List = block.ordered ? "ol" : "ul"

    return (
      <List
        className={cn(
          "space-y-1 pl-5",
          block.ordered
            ? "list-decimal"
            : "list-disc marker:text-muted-foreground",
        )}
      >
        {block.items.map((item, index) => (
          <li key={`${index}:${item}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </List>
    )
  }

  if (block.kind === "code") {
    return (
      <pre className="overflow-x-auto rounded-md border border-border/70 bg-muted/45 p-3 text-xs leading-6 text-foreground">
        <code>{block.text}</code>
      </pre>
    )
  }

  if (block.kind === "quote") {
    return (
      <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
        {block.lines.map((line, index) => (
          <p
            className="whitespace-pre-wrap"
            key={`${index}:${line}`}
          >
            {renderInlineMarkdown(line)}
          </p>
        ))}
      </blockquote>
    )
  }

  return (
    <p className="whitespace-pre-wrap">
      {renderInlineMarkdown(block.text)}
    </p>
  )
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (line.trim().length === 0) {
      index += 1
      continue
    }

    const fenceMatch = line.match(/^\s*```([A-Za-z0-9_-]+)?\s*$/)

    if (fenceMatch) {
      const codeLines: string[] = []
      index += 1

      while (
        index < lines.length &&
        !lines[index].match(/^\s*```\s*$/)
      ) {
        codeLines.push(lines[index])
        index += 1
      }

      if (index < lines.length) {
        index += 1
      }

      blocks.push({
        kind: "code",
        language: fenceMatch[1],
        text: codeLines.join("\n"),
      })
      continue
    }

    const headingMatch = line.match(/^\s*(#{1,3})\s+(.+)\s*$/)

    if (headingMatch) {
      blocks.push({
        kind: "heading",
        level: (headingMatch[1].length + 1) as 2 | 3 | 4,
        text: headingMatch[2],
      })
      index += 1
      continue
    }

    const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/)
    const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/)

    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch)
      const items: string[] = []

      while (index < lines.length) {
        const itemMatch = ordered
          ? lines[index].match(/^\s*\d+[.)]\s+(.+)$/)
          : lines[index].match(/^\s*[-*]\s+(.+)$/)

        if (!itemMatch) {
          break
        }

        items.push(itemMatch[1])
        index += 1
      }

      blocks.push({
        kind: "list",
        items,
        ordered,
      })
      continue
    }

    const quoteMatch = line.match(/^\s*>\s?(.*)$/)

    if (quoteMatch) {
      const linesInQuote: string[] = []

      while (index < lines.length) {
        const currentQuoteMatch = lines[index].match(/^\s*>\s?(.*)$/)

        if (!currentQuoteMatch) {
          break
        }

        linesInQuote.push(currentQuoteMatch[1])
        index += 1
      }

      blocks.push({
        kind: "quote",
        lines: linesInQuote,
      })
      continue
    }

    const paragraphLines = [line]
    index += 1

    while (index < lines.length && shouldContinueParagraph(lines[index])) {
      paragraphLines.push(lines[index])
      index += 1
    }

    blocks.push({
      kind: "paragraph",
      text: paragraphLines.join("\n"),
    })
  }

  return blocks
}

function shouldContinueParagraph(line: string) {
  return (
    line.trim().length > 0 &&
    !line.match(/^\s*```/) &&
    !line.match(/^\s*#{1,3}\s+/) &&
    !line.match(/^\s*[-*]\s+/) &&
    !line.match(/^\s*\d+[.)]\s+/) &&
    !line.match(/^\s*>\s?/)
  )
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const inlinePattern =
    /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g
  let previousIndex = 0
  let match: RegExpExecArray | null

  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > previousIndex) {
      nodes.push(text.slice(previousIndex, match.index))
    }

    nodes.push(renderInlineToken(match[0], nodes.length))
    previousIndex = match.index + match[0].length
  }

  if (previousIndex < text.length) {
    nodes.push(text.slice(previousIndex))
  }

  return nodes
}

function renderInlineToken(token: string, key: number) {
  if (token.startsWith("`") && token.endsWith("`")) {
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]"
        key={key}
      >
        {token.slice(1, -1)}
      </code>
    )
  }

  if (token.startsWith("**") && token.endsWith("**")) {
    return (
      <strong
        className="font-semibold"
        key={key}
      >
        {token.slice(2, -2)}
      </strong>
    )
  }

  const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)

  if (linkMatch) {
    const href = getSafeHref(linkMatch[2])

    if (href) {
      return (
        <a
          className="font-medium text-primary underline-offset-4 hover:underline"
          href={href}
          key={key}
          rel="noreferrer"
          target="_blank"
        >
          {linkMatch[1]}
        </a>
      )
    }
  }

  return token
}

function getSafeHref(href: string) {
  try {
    const url = new URL(href)

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString()
    }
  } catch {
    return null
  }

  return null
}
