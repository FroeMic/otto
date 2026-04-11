import fs from "node:fs/promises"

import { getDb } from "@otto/feature-integrations-runtime/db/client"
import { tenantServers, tenants } from "@otto/feature-integrations-runtime/db/schema"
import { eq } from "drizzle-orm"
import { Client, type ConnectConfig } from "ssh2"

import { getApiEnv, normalizePrivateKeyValue } from "../env"

export interface SshConnection {
  host: string
  port?: number
  privateKey?: string
  username?: string
}

export interface SshExecResult {
  exitCode: number | null
  stderr: string
  stdout: string
}

export async function getTenantRuntimeConnection(
  tenantId: string,
  context: string,
): Promise<SshConnection> {
  const db = getDb()
  const [tenantServer] = await db
    .select({
      ipv4: tenantServers.ipv4,
      serverStatus: tenantServers.status,
      sshUsername: tenantServers.sshUsername,
      tenantStatus: tenants.status,
    })
    .from(tenantServers)
    .innerJoin(tenants, eq(tenantServers.tenantId, tenants.id))
    .where(eq(tenantServers.tenantId, tenantId))
    .limit(1)

  if (!tenantServer?.ipv4) {
    throw new Error(`Tenant server IP is missing for ${context}`)
  }

  if (
    tenantServer.serverStatus !== "ready" ||
    tenantServer.tenantStatus !== "ready"
  ) {
    throw new Error(`${context} requires a ready tenant runtime`)
  }

  const env = getApiEnv()

  return {
    host: tenantServer.ipv4,
    port: env.RUNTIME_SSH_PORT,
    username: tenantServer.sshUsername ?? env.RUNTIME_SSH_USERNAME,
  }
}

export async function execTenantRuntimeCommand(
  connection: SshConnection,
  command: string,
): Promise<SshExecResult> {
  const env = getApiEnv()
  const client = new Client()
  const connectConfig = await buildConnectConfig(connection)

  return await new Promise<SshExecResult>((resolve, reject) => {
    let stdout = ""
    let stderr = ""
    let exitCode: number | null = null
    let settled = false
    const timeout = setTimeout(() => {
      rejectOnce(
        new Error(
          `SSH command timed out after ${env.RUNTIME_SSH_COMMAND_TIMEOUT_MS}ms: ${command.slice(0, 120)}`,
        ),
      )
    }, env.RUNTIME_SSH_COMMAND_TIMEOUT_MS)

    client.on("ready", () => {
      client.exec(command, (error, stream) => {
        if (error) {
          rejectOnce(error)
          return
        }

        stream.on("close", (code: number | undefined) => {
          exitCode = typeof code === "number" ? code : null
          resolveOnce({
            exitCode,
            stderr,
            stdout,
          })
        })

        stream.on("data", (chunk: Buffer | string) => {
          stdout += chunk.toString()
        })

        stream.stderr.on("data", (chunk: Buffer | string) => {
          stderr += chunk.toString()
        })
      })
    })

    client.on("error", (error) => {
      rejectOnce(error)
    })

    client.on("close", () => {
      if (!settled && exitCode === null) {
        rejectOnce(
          new Error(
            `SSH connection closed before command completed: ${command.slice(0, 120)}`,
          ),
        )
      }
    })

    try {
      client.connect(connectConfig)
    } catch (error) {
      rejectOnce(
        error instanceof Error ? error : new Error("Unknown SSH exec error"),
      )
    }

    function finalize() {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      client.removeAllListeners()
      client.on("error", () => {})
      client.end()
    }

    function resolveOnce(result: SshExecResult) {
      finalize()
      resolve(result)
    }

    function rejectOnce(error: Error) {
      finalize()
      reject(error)
    }
  })
}

async function buildConnectConfig(
  connection: SshConnection,
): Promise<ConnectConfig> {
  const env = getApiEnv()
  const privateKey = connection.privateKey ?? (await resolveRuntimeSshPrivateKey())
  const agent = !privateKey ? process.env.SSH_AUTH_SOCK : undefined

  if (!privateKey && !agent) {
    throw new Error(
      "SSH authentication is not configured. Set RUNTIME_DEPLOY_PRIVATE_KEY, RUNTIME_DEPLOY_PRIVATE_KEY_PATH, or run with SSH_AUTH_SOCK available.",
    )
  }

  return {
    ...(agent ? { agent } : {}),
    ...(privateKey ? { privateKey } : {}),
    host: connection.host,
    port: connection.port ?? env.RUNTIME_SSH_PORT,
    readyTimeout: env.RUNTIME_SSH_CONNECT_TIMEOUT_MS,
    username: connection.username ?? env.RUNTIME_SSH_USERNAME,
  }
}

async function resolveRuntimeSshPrivateKey() {
  const env = getApiEnv()

  if (env.RUNTIME_DEPLOY_PRIVATE_KEY) {
    return normalizePrivateKeyValue(env.RUNTIME_DEPLOY_PRIVATE_KEY)
  }

  if (env.RUNTIME_DEPLOY_PRIVATE_KEY_PATH) {
    return await fs.readFile(env.RUNTIME_DEPLOY_PRIVATE_KEY_PATH, "utf8")
  }

  return undefined
}

