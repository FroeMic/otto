const TRUTHY_DEBUG_VALUES = new Set(["1", "true", "yes", "on"])

export function isRuntimeDebugLoggingEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return TRUTHY_DEBUG_VALUES.has(
    (env.OTTO_RUNTIME_DEBUG_LOGS ?? "").trim().toLowerCase(),
  )
}

export function runtimeDebugLog(message: string, fields?: unknown) {
  if (!isRuntimeDebugLoggingEnabled()) {
    return
  }

  if (fields === undefined) {
    console.debug(message)
    return
  }

  console.debug(message, fields)
}
