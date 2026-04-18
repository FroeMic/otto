const DEFAULT_STORAGE_KEY = "otto.stale-asset-reload"
const RELOAD_COOLDOWN_MS = 60_000

interface ReloadStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface ShouldReloadForStaleAssetInput {
  now: number
  storage: ReloadStorage
  storageKey?: string
  url: string
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  return ""
}

export function isStaleAssetLoadError(error: unknown) {
  const message = getErrorMessage(error)

  return (
    message.includes("Failed to fetch dynamically imported module") &&
    message.includes("/assets/")
  )
}

export function shouldReloadForStaleAsset({
  now,
  storage,
  storageKey = DEFAULT_STORAGE_KEY,
  url,
}: ShouldReloadForStaleAssetInput) {
  const rawPreviousReload = storage.getItem(storageKey)

  if (rawPreviousReload) {
    try {
      const previousReload = JSON.parse(rawPreviousReload) as {
        at?: unknown
        url?: unknown
      }

      if (
        previousReload.url === url &&
        typeof previousReload.at === "number" &&
        now - previousReload.at < RELOAD_COOLDOWN_MS
      ) {
        return false
      }
    } catch {
      // Ignore malformed storage and overwrite it below.
    }
  }

  storage.setItem(storageKey, JSON.stringify({ at: now, url }))

  return true
}

function getCurrentUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function reloadForStaleAssetError(error: unknown) {
  if (!isStaleAssetLoadError(error)) {
    return false
  }

  if (
    !shouldReloadForStaleAsset({
      now: Date.now(),
      storage: window.sessionStorage,
      url: getCurrentUrl(),
    })
  ) {
    return false
  }

  window.location.reload()

  return true
}

export function installStaleAssetReloadHandler() {
  window.addEventListener("error", (event) => {
    reloadForStaleAssetError(event.error ?? event.message)
  })

  window.addEventListener("unhandledrejection", (event) => {
    reloadForStaleAssetError(event.reason)
  })
}
