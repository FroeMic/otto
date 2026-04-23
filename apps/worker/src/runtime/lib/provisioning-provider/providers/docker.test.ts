import { beforeEach, describe, expect, it, vi } from "vitest"

import { __testing, DockerProvisioningProvider } from "./docker"

describe("DockerProvisioningProvider", () => {
  function createRunCommandMock() {
    return vi.fn<
      (
        args: string[],
      ) => Promise<{ code: number; stderr: string; stdout: string }>
    >()
  }

  beforeEach(() => {
    __testing.resetReservedSshPorts()
  })

  it("creates a docker host and normalizes endpoint metadata", async () => {
    const runCommand = createRunCommandMock()
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: JSON.stringify({
          Config: { User: "root" },
          Id: "created-container-id",
          Name: "/tenant-host-tenant-1",
          NetworkSettings: {
            IPAddress: "172.18.0.10",
            Networks: {
              "otto-tenant-labs": {
                IPAddress: "172.18.0.10",
              },
            },
            Ports: {
              "22/tcp": [
                {
                  HostIp: "127.0.0.1",
                  HostPort: "22000",
                },
              ],
            },
          },
          State: {
            Status: "running",
          },
        }),
      })

    const provider = new DockerProvisioningProvider({
      dockerBin: "docker",
      hostImage: "ghcr.io/example/tenant-host:latest",
      networkName: "otto-tenant-labs",
      pollIntervalMs: 1,
      runCommand,
      sshHost: "host.docker.internal",
      sshPortRangeEnd: 22050,
      sshPortRangeStart: 22000,
      sshUsername: "runtime-user",
      startupTimeoutMs: 1000,
      tenantHostPrefix: "tenant-host",
    })

    const host = await provider.createHost({
      tenantId: "tenant_1",
    })

    expect(host.id).toBe("created-container-id")
    expect(host.host).toBe("host.docker.internal")
    expect(host.sshPort).toBe(22000)
    expect(host.sshUsername).toBe("root")
    expect(host.status).toBe("running")
    expect(runCommand).toHaveBeenCalledTimes(4)
  })

  it("reuses existing host when container name already exists", async () => {
    const runCommand = createRunCommandMock()
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: "",
      })
      .mockResolvedValueOnce({
        code: 1,
        stderr:
          'Conflict. The container name "/tenant-host-tenant-2" is already in use.',
        stdout: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: JSON.stringify({
          Config: { User: "root" },
          Id: "existing-container-id",
          Name: "/tenant-host-tenant-2",
          NetworkSettings: {
            IPAddress: "172.18.0.12",
            Networks: {
              "otto-tenant-labs": {
                IPAddress: "172.18.0.12",
              },
            },
            Ports: {
              "22/tcp": [
                {
                  HostIp: "127.0.0.1",
                  HostPort: "22000",
                },
              ],
            },
          },
          State: {
            Status: "running",
          },
        }),
      })

    const provider = new DockerProvisioningProvider({
      dockerBin: "docker",
      hostImage: "ghcr.io/example/tenant-host:latest",
      networkName: "otto-tenant-labs",
      pollIntervalMs: 1,
      runCommand,
      sshHost: "host.docker.internal",
      sshPortRangeEnd: 22050,
      sshPortRangeStart: 22000,
      sshUsername: "runtime-user",
      startupTimeoutMs: 1000,
      tenantHostPrefix: "tenant-host",
    })

    const host = await provider.createHost({
      tenantId: "tenant_2",
    })

    expect(host.id).toBe("existing-container-id")
    expect(host.sshPort).toBe(22000)
  })

  it("supports container_name endpoint mode without host port publishing", async () => {
    const runCommand = createRunCommandMock()
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: "[]",
      })
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: JSON.stringify({
          Config: { User: "1000" },
          Id: "container-mode-id",
          Name: "/tenant-host-tenant_3",
          NetworkSettings: {
            IPAddress: "172.18.0.13",
            Networks: {
              "otto-tenant-labs": {
                IPAddress: "172.18.0.13",
              },
            },
            Ports: {
              "22/tcp": null,
            },
          },
          State: {
            Status: "running",
          },
        }),
      })

    const provider = new DockerProvisioningProvider({
      dockerBin: "docker",
      hostImage: "ghcr.io/example/tenant-host:latest",
      networkName: "otto-tenant-labs",
      pollIntervalMs: 1,
      runCommand,
      sshHost: "host.docker.internal",
      sshPortRangeEnd: 22050,
      sshPortRangeStart: 22000,
      sshUsername: "runtime-user",
      startupTimeoutMs: 1000,
      tenantHostPrefix: "tenant-host",
    })

    const host = await provider.createHost({
      docker: {
        endpointHost: "ignored",
        endpointMode: "container_name",
        hostImage: "ghcr.io/example/tenant-host:latest",
        networkName: "otto-tenant-labs",
        sshPort: 22,
        sshUsername: "root",
      },
      tenantId: "tenant_3",
    })

    expect(host.host).toBe("tenant-host-tenant_3")
    expect(host.sshPort).toBe(22)
    expect(host.sshUsername).toBe("1000")
    expect(runCommand.mock.calls.some(([args]) => args.includes("-p"))).toBe(
      false,
    )
  })

  it("waits for host action to reach running", async () => {
    const runCommand = createRunCommandMock()
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: JSON.stringify({
          Config: { User: "root" },
          Id: "container-id",
          Name: "/tenant-host-tenant-4",
          NetworkSettings: {
            IPAddress: "172.18.0.14",
            Ports: {
              "22/tcp": [
                {
                  HostIp: "127.0.0.1",
                  HostPort: "22000",
                },
              ],
            },
          },
          State: {
            Status: "created",
          },
        }),
      })
      .mockResolvedValueOnce({
        code: 0,
        stderr: "",
        stdout: JSON.stringify({
          Config: { User: "root" },
          Id: "container-id",
          Name: "/tenant-host-tenant-4",
          NetworkSettings: {
            IPAddress: "172.18.0.14",
            Ports: {
              "22/tcp": [
                {
                  HostIp: "127.0.0.1",
                  HostPort: "22000",
                },
              ],
            },
          },
          State: {
            Status: "running",
          },
        }),
      })

    const provider = new DockerProvisioningProvider({
      dockerBin: "docker",
      hostImage: "ghcr.io/example/tenant-host:latest",
      networkName: "otto-tenant-labs",
      pollIntervalMs: 1,
      runCommand,
      sshHost: "host.docker.internal",
      sshPortRangeEnd: 22050,
      sshPortRangeStart: 22000,
      sshUsername: "runtime-user",
      startupTimeoutMs: 1000,
      tenantHostPrefix: "tenant-host",
    })

    await expect(
      provider.waitForHostAction({
        actionId: "docker-run:tenant-host-tenant-4",
        providerServerId: "tenant-host-tenant-4",
      }),
    ).resolves.toBeUndefined()
  })

  it("deletes host idempotently when container is missing", async () => {
    const runCommand = createRunCommandMock().mockResolvedValue({
      code: 1,
      stderr: "Error response from daemon: No such container: missing",
      stdout: "",
    })

    const provider = new DockerProvisioningProvider({
      dockerBin: "docker",
      hostImage: "ghcr.io/example/tenant-host:latest",
      networkName: "otto-tenant-labs",
      pollIntervalMs: 1,
      runCommand,
      sshHost: "host.docker.internal",
      sshPortRangeEnd: 22050,
      sshPortRangeStart: 22000,
      sshUsername: "runtime-user",
      startupTimeoutMs: 1000,
      tenantHostPrefix: "tenant-host",
    })

    await expect(provider.deleteHost("missing")).resolves.toBeUndefined()
  })

  it("detects missing container as not found errors", () => {
    const provider = new DockerProvisioningProvider({
      dockerBin: "docker",
      hostImage: "ghcr.io/example/tenant-host:latest",
      networkName: "otto-tenant-labs",
      pollIntervalMs: 1,
      runCommand: vi.fn(),
      sshHost: "host.docker.internal",
      sshPortRangeEnd: 22050,
      sshPortRangeStart: 22000,
      sshUsername: "runtime-user",
      startupTimeoutMs: 1000,
      tenantHostPrefix: "tenant-host",
    })

    expect(
      provider.isHostNotFoundError(
        new Error("Docker tenant host not found: missing"),
      ),
    ).toBe(true)
    expect(provider.isHostNotFoundError(new Error("other"))).toBe(false)
  })
})
