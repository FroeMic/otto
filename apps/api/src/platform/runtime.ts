import {
  execTenantRuntimeCommand,
  getTenantRuntimeConnection,
} from "../tenant-runtime/ssh"

const DEFAULT_RUNTIME_CONTAINER = "openclaw-gateway"

export async function inspectObservedRuntimeImageForTenant(input: {
  serverStatus: string | null
  status: string
  tenantId: string
}): Promise<string | null> {
  if (input.status !== "ready" || input.serverStatus !== "ready") {
    return null
  }

  try {
    const connection = await getTenantRuntimeConnection(
      input.tenantId,
      "platform runtime image inspection",
    )
    const result = await execTenantRuntimeCommand(
      connection,
      `docker inspect ${DEFAULT_RUNTIME_CONTAINER} --format '{{.Config.Image}}' 2>/dev/null || true`,
    )
    const image = result.stdout.trim()

    return image.length > 0 ? image : null
  } catch {
    return null
  }
}
