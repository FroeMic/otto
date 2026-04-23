import { spawn } from "node:child_process"

import { getEnv } from "../../env"
import type {
  CreateProvisioningHostInput,
  ProvisioningProvider,
} from "../interface"
import type { ProvisioningHost } from "../types"

const CONTAINER_STATUS_TO_PROVIDER_STATUS: Record<string, string> = {
  created: "creating",
  dead: "failed",
  exited: "failed",
  paused: "paused",
  removing: "deleting",
  restarting: "starting",
  running: "running",
}

type DockerContainerInspectState = {
  Running?: boolean
  Status?: string
}

type DockerContainerInspectNetwork = {
  IPAddress?: string
}

type DockerContainerInspectConfig = {
  User?: string
}

type DockerContainerInspectNetworkSettings = {
  IPAddress?: string
  Ports?: Record<
    string,
    Array<{
      HostIp?: string
      HostPort?: string
    }> | null
  >
  Networks?: Record<string, DockerContainerInspectNetwork>
}

type DockerContainerInspectResult = {
  Config?: DockerContainerInspectConfig
  Id?: string
  Name?: string
  NetworkSettings?: DockerContainerInspectNetworkSettings
  State?: DockerContainerInspectState
}

type ExecDockerCommandResult = {
  code: number
  stderr: string
  stdout: string
}

type DockerCommandRunner = (args: string[]) => Promise<ExecDockerCommandResult>

const reservedSshPorts = new Set<number>()

export class DockerProvisioningProvider implements ProvisioningProvider {
  readonly deletesRemoteHosts = true
  readonly id = "docker" as const
  private readonly dockerBin: string
  private readonly hostImage: string
  private readonly networkName: string
  private readonly pollIntervalMs: number
  private readonly startupTimeoutMs: number
  private readonly sshHost: string
  private readonly sshPortRangeEnd: number
  private readonly sshPortRangeStart: number
  private readonly sshUsername: string
  private readonly endpointMode: "container_name" | "published_port"
  private readonly containerSshPort: number
  private readonly tenantHostPrefix: string
  private readonly runCommand: DockerCommandRunner

  constructor(
    input: {
      dockerBin: string
      hostImage: string
      networkName: string
      pollIntervalMs: number
      runCommand?: DockerCommandRunner
      endpointMode?: "container_name" | "published_port"
      containerSshPort?: number
      sshHost: string
      sshPortRangeEnd: number
      sshPortRangeStart: number
      sshUsername?: string
      startupTimeoutMs: number
      tenantHostPrefix: string
    } = {
      dockerBin: getEnv().TENANT_RUNTIME_DOCKER_DOCKER_BIN,
      hostImage: getEnv().TENANT_RUNTIME_DOCKER_HOST_IMAGE,
      networkName: getEnv().TENANT_RUNTIME_DOCKER_NETWORK,
      pollIntervalMs: getEnv().TENANT_RUNTIME_DOCKER_POLL_INTERVAL_MS,
      sshHost: getEnv().TENANT_RUNTIME_DOCKER_SSH_HOST,
      sshPortRangeEnd: getEnv().TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_END,
      sshPortRangeStart: getEnv().TENANT_RUNTIME_DOCKER_SSH_PORT_RANGE_START,
      endpointMode: getEnv().TENANT_RUNTIME_DOCKER_ENDPOINT_MODE,
      containerSshPort: getEnv().RUNTIME_SSH_PORT,
      sshUsername: getEnv().TENANT_RUNTIME_DOCKER_SSH_USERNAME,
      startupTimeoutMs: getEnv().TENANT_RUNTIME_DOCKER_STARTUP_TIMEOUT_MS,
      tenantHostPrefix: getEnv().TENANT_RUNTIME_DOCKER_CONTAINER_PREFIX,
    },
  ) {
    this.dockerBin = input.dockerBin
    this.hostImage = input.hostImage
    this.networkName = input.networkName
    this.pollIntervalMs = input.pollIntervalMs
    this.sshHost = input.sshHost
    this.sshPortRangeEnd = input.sshPortRangeEnd
    this.sshPortRangeStart = input.sshPortRangeStart
    this.sshUsername = input.sshUsername ?? "root"
    this.endpointMode = input.endpointMode ?? "published_port"
    this.containerSshPort = input.containerSshPort ?? 22
    this.startupTimeoutMs = input.startupTimeoutMs
    this.tenantHostPrefix = input.tenantHostPrefix
    this.runCommand =
      input.runCommand ?? ((args) => execDockerCommand(this.dockerBin, args))
  }

  async createHost(
    input: CreateProvisioningHostInput,
  ): Promise<ProvisioningHost> {
    const hostImage = input.docker?.hostImage ?? this.hostImage
    const networkName = input.docker?.networkName ?? this.networkName
    const containerName = buildTenantContainerName(
      this.tenantHostPrefix,
      input.tenantId,
    )
    const endpointMode = input.docker?.endpointMode ?? this.endpointMode
    const endpointHost =
      endpointMode === "container_name"
        ? containerName
        : (input.docker?.endpointHost ?? this.sshHost)
    const endpointSshPort =
      input.docker?.sshPort ??
      (endpointMode === "container_name" ? this.containerSshPort : 22)
    const endpointSshUsername = input.docker?.sshUsername ?? this.sshUsername

    const publishesSshPort = endpointMode === "published_port"
    const hostPort = publishesSshPort
      ? await this.allocateSshPort(containerName)
      : endpointSshPort
    try {
      const runError = await this.startTenantHostContainer({
        containerName,
        hostPort,
        hostImage,
        networkName,
        publishesSshPort,
        tenantId: input.tenantId,
      })
      const host = await this.waitForContainerReady(containerName, runError, {
        defaultSshUsername: endpointSshUsername,
        endpointHost,
        endpointMode,
        fallbackSshPort: endpointSshPort,
      })

      return {
        ...host,
        actionId: `docker-run:${containerName}`,
        sshPort: host.sshPort ?? endpointSshPort,
        sshUsername: host.sshUsername ?? endpointSshUsername,
      }
    } finally {
      if (publishesSshPort) {
        reservedSshPorts.delete(hostPort)
      }
    }
  }

  async deleteHost(providerServerId: string): Promise<void> {
    const target = providerServerId.trim()
    if (!target) {
      return
    }

    const removeResult = await this.execDockerCommand(["rm", "-f", target])

    if (removeResult.code === 0) {
      return
    }

    if (isDockerNotFoundMessage(removeResult.stderr)) {
      return
    }

    throw new Error(
      `Failed to delete Docker tenant host ${target}: ${normalizeCommandErrorMessage(removeResult.stderr)}`,
    )
  }

  async getHost(providerServerId: string): Promise<ProvisioningHost> {
    const inspect = await this.getContainerInspect(providerServerId)
    return normalizeDockerInspectResult({
      defaultSshUsername: this.sshUsername,
      endpointHost: this.sshHost,
      endpointMode: this.endpointMode,
      fallbackSshPort: this.containerSshPort,
      inspect,
    })
  }

  isHostNotFoundError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message.includes("Docker tenant host not found")
    )
  }

  async waitForHostAction(input: {
    actionId: string
    providerServerId: string
  }): Promise<void> {
    const deadline = Date.now() + this.startupTimeoutMs

    while (Date.now() < deadline) {
      const host = await this.getHost(input.providerServerId)

      if (host.status === "running") {
        return
      }

      if (host.status === "failed" || host.status === "deleting") {
        throw new Error(
          `Docker tenant host ${input.providerServerId} entered terminal status ${host.status} while waiting for action ${input.actionId}`,
        )
      }

      await sleep(this.pollIntervalMs)
    }

    throw new Error(
      `Timed out waiting for Docker tenant host ${input.providerServerId} to become running`,
    )
  }

  private async startTenantHostContainer(input: {
    containerName: string
    hostPort: number
    hostImage: string
    networkName: string
    publishesSshPort: boolean
    tenantId: string
  }): Promise<string | null> {
    const labels = {
      "otto/managed": "true",
      "otto/role": "tenant-host",
      "otto/tenant_id": input.tenantId,
    }
    const labelArgs = Object.entries(labels).flatMap(([key, value]) => [
      "--label",
      `${key}=${value}`,
    ])

    await this.ensureNetworkExists(input.networkName)

    const runResult = await this.execDockerCommand([
      "run",
      "-d",
      "--name",
      input.containerName,
      "--restart",
      "unless-stopped",
      "--network",
      input.networkName,
      ...(input.publishesSshPort ? ["-p", `${input.hostPort}:22`] : []),
      ...labelArgs,
      input.hostImage,
      "sh",
      "-lc",
      "if command -v /usr/sbin/sshd >/dev/null 2>&1; then exec /usr/sbin/sshd -D -e; elif command -v sshd >/dev/null 2>&1; then exec sshd -D -e; else echo 'sshd not found in tenant host image' >&2; exit 127; fi",
    ])

    if (runResult.code === 0) {
      return null
    }

    const errorMessage = normalizeCommandErrorMessage(runResult.stderr)
    if (isContainerAlreadyExistsError(errorMessage)) {
      return null
    }

    return errorMessage
  }

  private async waitForContainerReady(
    containerName: string,
    runError: string | null,
    connection: {
      defaultSshUsername: string
      endpointHost: string
      endpointMode: "container_name" | "published_port"
      fallbackSshPort: number
    },
  ): Promise<ProvisioningHost> {
    const deadline = Date.now() + this.startupTimeoutMs
    let lastError: string | null = runError

    while (Date.now() < deadline) {
      try {
        const inspect = await this.getContainerInspect(containerName)
        const host = normalizeDockerInspectResult({
          defaultSshUsername: connection.defaultSshUsername,
          endpointHost: connection.endpointHost,
          endpointMode: connection.endpointMode,
          fallbackSshPort: connection.fallbackSshPort,
          inspect,
        })

        if (host.status === "running") {
          return host
        }

        lastError = `container status is ${host.status}`
      } catch (error) {
        lastError = error instanceof Error ? error.message : "unknown error"
      }

      await sleep(this.pollIntervalMs)
    }

    throw new Error(
      `Timed out waiting for Docker tenant host ${containerName} to become running${lastError ? ` (${lastError})` : ""}`,
    )
  }

  private async getContainerInspectOrNull(containerName: string) {
    const inspectResult = await this.execDockerCommand([
      "inspect",
      containerName,
      "--format",
      "{{json .}}",
    ])

    if (inspectResult.code !== 0) {
      if (isDockerNotFoundMessage(inspectResult.stderr)) {
        return null
      }
      throw new Error(
        `Failed to inspect Docker tenant host ${containerName}: ${normalizeCommandErrorMessage(inspectResult.stderr)}`,
      )
    }

    return parseDockerInspectResult(inspectResult.stdout, containerName)
  }

  private async getContainerInspect(containerName: string) {
    const inspect = await this.getContainerInspectOrNull(containerName)

    if (!inspect) {
      throw new Error(`Docker tenant host not found: ${containerName}`)
    }

    return inspect
  }

  private async allocateSshPort(containerName: string) {
    const portRange = Array.from(
      { length: this.sshPortRangeEnd - this.sshPortRangeStart + 1 },
      (_, index) => this.sshPortRangeStart + index,
    )

    for (const port of portRange) {
      if (reservedSshPorts.has(port)) {
        continue
      }

      const inspectResult = await this.execDockerCommand([
        "ps",
        "--all",
        "--filter",
        `publish=${port}`,
        "--format",
        "{{.Names}}",
      ])

      if (inspectResult.code !== 0) {
        throw new Error(
          `Failed to discover allocated Docker SSH ports for ${containerName}: ${normalizeCommandErrorMessage(inspectResult.stderr)}`,
        )
      }

      const inUseBy = inspectResult.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)

      if (
        inUseBy.length === 0 ||
        inUseBy.every((name) => name === containerName)
      ) {
        reservedSshPorts.add(port)
        return port
      }
    }

    throw new Error(
      `No free Docker tenant SSH port available in range ${this.sshPortRangeStart}-${this.sshPortRangeEnd}`,
    )
  }

  private async execDockerCommand(args: string[]) {
    return await this.runCommand(args)
  }

  private async ensureNetworkExists(networkName: string) {
    const inspectResult = await this.execDockerCommand([
      "network",
      "inspect",
      networkName,
    ])

    if (inspectResult.code === 0) {
      return
    }

    if (!isDockerNetworkNotFoundMessage(inspectResult.stderr)) {
      throw new Error(
        `Failed to inspect Docker network ${networkName}: ${normalizeCommandErrorMessage(inspectResult.stderr)}`,
      )
    }

    const createResult = await this.execDockerCommand([
      "network",
      "create",
      networkName,
    ])
    if (
      createResult.code !== 0 &&
      !isDockerNetworkAlreadyExistsMessage(createResult.stderr)
    ) {
      throw new Error(
        `Failed to create Docker network ${networkName}: ${normalizeCommandErrorMessage(createResult.stderr)}`,
      )
    }
  }
}

async function execDockerCommand(
  dockerBin: string,
  args: string[],
): Promise<ExecDockerCommandResult> {
  return await new Promise<ExecDockerCommandResult>((resolve, reject) => {
    const child = spawn(dockerBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })

    child.on("error", (error) => {
      reject(error)
    })

    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stderr,
        stdout,
      })
    })
  })
}

function parseDockerInspectResult(
  output: string,
  containerName: string,
): DockerContainerInspectResult {
  const trimmed = output.trim()
  if (!trimmed) {
    throw new Error(`Docker inspect returned empty output for ${containerName}`)
  }

  try {
    const parsed = JSON.parse(trimmed) as
      | DockerContainerInspectResult
      | DockerContainerInspectResult[]

    if (Array.isArray(parsed)) {
      const first = parsed[0]
      if (!first) {
        throw new Error("Docker inspect result array was empty")
      }
      return first
    }

    return parsed
  } catch (error) {
    throw new Error(
      `Docker inspect returned invalid JSON for ${containerName}: ${error instanceof Error ? error.message : "unknown parse error"}`,
    )
  }
}

function normalizeDockerInspectResult(input: {
  defaultSshUsername: string
  endpointHost: string
  endpointMode: "container_name" | "published_port"
  fallbackSshPort?: number
  inspect: DockerContainerInspectResult
}): ProvisioningHost {
  const name = input.inspect.Name?.replace(/^\/+/, "")
  const sshPort =
    input.endpointMode === "container_name"
      ? (input.fallbackSshPort ?? 22)
      : (resolvePublishedSshPort(input.inspect) ?? input.fallbackSshPort)
  const ipv4 = resolveIpv4(input.inspect)
  const status = normalizeDockerStatus(input.inspect.State?.Status)
  const sshUsername = resolveSshUsername(
    input.inspect.Config?.User,
    input.defaultSshUsername,
  )
  const id = input.inspect.Id?.trim() || name

  return {
    host:
      input.endpointMode === "container_name"
        ? (name ?? input.endpointHost)
        : input.endpointHost,
    id: id ?? "unknown-docker-container",
    ipv4,
    sshPort,
    sshUsername,
    status,
  }
}

function resolvePublishedSshPort(inspect: DockerContainerInspectResult) {
  const bindings = inspect.NetworkSettings?.Ports?.["22/tcp"]
  const firstBinding = bindings?.[0]
  const hostPort = firstBinding?.HostPort

  if (!hostPort) {
    return undefined
  }

  const parsed = Number.parseInt(hostPort, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}

function resolveIpv4(inspect: DockerContainerInspectResult) {
  const directIp = inspect.NetworkSettings?.IPAddress?.trim()
  if (directIp) {
    return directIp
  }

  const networks = inspect.NetworkSettings?.Networks
  if (!networks) {
    return undefined
  }

  for (const network of Object.values(networks)) {
    const ip = network.IPAddress?.trim()
    if (ip) {
      return ip
    }
  }

  return undefined
}

function normalizeDockerStatus(status?: string) {
  if (!status) {
    return "unknown"
  }

  return CONTAINER_STATUS_TO_PROVIDER_STATUS[status] ?? status
}

function resolveSshUsername(
  configUser: string | undefined,
  defaultSshUsername: string,
) {
  const normalizedUser = configUser?.trim()
  if (
    normalizedUser &&
    normalizedUser !== "0" &&
    normalizedUser !== "root:root"
  ) {
    return normalizedUser
  }

  return defaultSshUsername
}

function normalizeCommandErrorMessage(stderr: string) {
  const trimmed = stderr.trim()
  return trimmed.length > 0 ? trimmed : "unknown docker command error"
}

function isDockerNotFoundMessage(stderr: string) {
  return (
    /No such container/i.test(stderr) ||
    /No such object/i.test(stderr) ||
    /not found/i.test(stderr)
  )
}

function isDockerNetworkNotFoundMessage(stderr: string) {
  return /network .* not found/i.test(stderr) || /No such network/i.test(stderr)
}

function isDockerNetworkAlreadyExistsMessage(stderr: string) {
  return /already exists/i.test(stderr)
}

function isContainerAlreadyExistsError(stderr: string) {
  return /container name .* is already in use/i.test(stderr)
}

function buildTenantContainerName(prefix: string, tenantId: string) {
  const normalizedTenantId = tenantId.replace(/[^a-zA-Z0-9_.-]/g, "-")
  return `${prefix}-${normalizedTenantId}`
}

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, durationMs))
}

export const __testing = {
  resetReservedSshPorts() {
    reservedSshPorts.clear()
  },
}
