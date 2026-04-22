import {
  Children,
  createContext,
  type HTMLAttributes,
  isValidElement,
  type PropsWithChildren,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { cn } from "@/lib/utils"

interface PageFrameContextValue {
  asideOpen: boolean
  asideWidth: number
  maxAsideWidth: number
  minAsideWidth: number
  resizableAside: boolean
  setAsideOpen: (value: boolean) => void
  setAsideWidth: (value: number) => void
  toggleAside: () => void
}

export interface PageFrameProps extends PropsWithChildren {
  defaultAsideOpen?: boolean
  defaultAsideWidth?: number
  maxAsideWidth?: number
  minAsideWidth?: number
  resizableAside?: boolean
}

export interface PageFrameBodyProps extends PropsWithChildren {
  hasAside?: boolean
}

export interface PageFrameSectionProps
  extends PropsWithChildren<HTMLAttributes<HTMLElement>> {
  className?: string
}

const PageFrameContext = createContext<PageFrameContextValue | null>(null)

function clampPanelSize(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function PageFrame({
  children,
  defaultAsideOpen = true,
  defaultAsideWidth = 320,
  maxAsideWidth = 420,
  minAsideWidth = 280,
  resizableAside = true,
}: PageFrameProps) {
  const [asideOpen, setAsideOpen] = useState(defaultAsideOpen)
  const [asideWidth, setAsideWidthState] = useState(() =>
    clampPanelSize(defaultAsideWidth, minAsideWidth, maxAsideWidth),
  )

  const setAsideWidth = useCallback(
    (value: number) => {
      setAsideWidthState(clampPanelSize(value, minAsideWidth, maxAsideWidth))
    },
    [maxAsideWidth, minAsideWidth],
  )

  const value = useMemo(
    () => ({
      asideOpen,
      asideWidth,
      maxAsideWidth,
      minAsideWidth,
      resizableAside,
      setAsideOpen,
      setAsideWidth,
      toggleAside: () => {
        setAsideOpen((currentValue) => !currentValue)
      },
    }),
    [
      asideOpen,
      asideWidth,
      maxAsideWidth,
      minAsideWidth,
      resizableAside,
      setAsideWidth,
    ],
  )

  return (
    <PageFrameContext.Provider value={value}>
      <section className="grid h-full min-h-0 grid-rows-[auto,minmax(0,1fr),auto] overflow-hidden">
        {children}
      </section>
    </PageFrameContext.Provider>
  )
}

export function usePageFrame() {
  const context = useContext(PageFrameContext)

  if (!context) {
    throw new Error("usePageFrame must be used inside PageFrame")
  }

  return context
}

export function PageFrameHeader({
  children,
  className,
  ...props
}: PageFrameSectionProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-4 border-b px-5 py-4",
        className,
      )}
      {...props}
    >
      {children}
    </header>
  )
}

export function PageFrameBody({
  children,
  hasAside = false,
}: PageFrameBodyProps) {
  const { asideOpen, asideWidth } = usePageFrame()
  const childArray = Children.toArray(children)
  const inferredAsidePresence = childArray.some(
    (child) => isValidElement(child) && child.type === PageFrameAside,
  )
  const shouldAllocateAsideColumn = hasAside || inferredAsidePresence

  return (
    <div
      className="grid min-h-0 flex-1"
      style={{
        gridTemplateColumns:
          shouldAllocateAsideColumn && asideOpen
            ? `minmax(0, 1fr) ${asideWidth}px`
            : "minmax(0, 1fr)",
      }}
    >
      {children}
    </div>
  )
}

export function PageFrameMain({
  children,
  className,
  ...props
}: PageFrameSectionProps) {
  return (
    <main
      className={cn("min-h-0 overflow-auto px-5 py-5", className)}
      data-shell-scroll-region="main"
      {...props}
    >
      {children}
    </main>
  )
}

export function PageFrameAside({
  children,
  className,
  ...props
}: PageFrameSectionProps) {
  const { asideOpen, asideWidth, resizableAside, setAsideWidth } =
    usePageFrame()

  const startResizing = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      const startX = event.clientX
      const initialWidth = asideWidth

      const handleMouseMove = (moveEvent: MouseEvent) => {
        setAsideWidth(initialWidth + (startX - moveEvent.clientX))
      }

      const handleMouseUp = () => {
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }

      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    },
    [asideWidth, setAsideWidth],
  )

  if (!asideOpen) {
    return null
  }

  return (
    <aside
      aria-label="Page aside"
      className={cn(
        "relative min-h-0 overflow-hidden border-l bg-muted/25",
        className,
      )}
      data-shell-scroll-region="aside"
      style={{ width: asideWidth }}
      {...props}
    >
      {resizableAside ? (
        <button
          aria-label="Resize page aside"
          className="absolute bottom-0 left-[-6px] top-0 z-10 w-3 cursor-col-resize"
          onMouseDown={startResizing}
          type="button"
        >
          <div className="mx-auto h-full w-px rounded-full bg-border transition-colors hover:bg-foreground/25" />
        </button>
      ) : null}

      <div className="h-full min-h-0 overflow-auto px-4 py-5">{children}</div>
    </aside>
  )
}

export function PageFrameFooter({
  children,
  className,
  ...props
}: PageFrameSectionProps) {
  return (
    <footer
      className={cn(
        "flex items-center justify-between gap-4 border-t px-5 py-3 text-sm text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </footer>
  )
}
