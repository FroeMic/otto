import type { ReactNode } from "react"

export interface AgentInstructionHeaderProps {
  children?: ReactNode
}

export function AgentInstructionHeader({
  children,
}: AgentInstructionHeaderProps) {
  return (
    <section className="flex max-w-2xl flex-col gap-3">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Agent</p>
        <h1 className="min-w-0 text-3xl font-semibold tracking-tight">Otto</h1>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Review the instruction files that shape how Otto works with your
            workspace.
          </p>
        </div>
      </div>
      {children}
    </section>
  )
}
