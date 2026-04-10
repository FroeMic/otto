import { lazy, Suspense } from "react"

const LazyPlatformPage = lazy(() =>
  import("./PlatformPage").then((module) => ({
    default: module.PlatformPage,
  })),
)

export function PlatformRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-muted-foreground">
          Loading platform…
        </div>
      }
    >
      <LazyPlatformPage />
    </Suspense>
  )
}
