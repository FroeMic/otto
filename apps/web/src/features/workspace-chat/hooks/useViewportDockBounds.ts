import type { CSSProperties } from "react"
import { useEffect, useRef, useState } from "react"

export function useViewportDockBounds() {
  const boundsRef = useRef<HTMLDivElement | null>(null)
  const [dockStyle, setDockStyle] = useState<CSSProperties | undefined>(
    undefined,
  )

  useEffect(() => {
    const element = boundsRef.current

    if (!element) {
      return
    }

    const updateDockStyle = () => {
      const rect = element.getBoundingClientRect()

      if (rect.width <= 0) {
        return
      }

      setDockStyle({
        left: `${Math.round(rect.left)}px`,
        width: `${Math.round(rect.width)}px`,
      })
    }

    updateDockStyle()

    const resizeObserver = new ResizeObserver(updateDockStyle)
    resizeObserver.observe(element)
    window.addEventListener("resize", updateDockStyle)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateDockStyle)
    }
  }, [])

  return {
    boundsRef,
    dockStyle,
  }
}
