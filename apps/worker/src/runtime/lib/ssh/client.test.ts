import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sshMocks = vi.hoisted(() => ({
  activeStream: null as null | {
    emit: (event: string, error?: Error) => boolean;
    stderr: {
      emit: (event: string, chunk?: string) => boolean;
    };
  },
  clients: [] as Array<{
    connect: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("ssh2", async () => {
  const { EventEmitter } =
    await vi.importActual<typeof import("node:events")>("node:events");

  class FakeClient extends EventEmitter {
    connect = vi.fn(() => {
      queueMicrotask(() => {
        this.emit("ready");
      });
    });

    end = vi.fn();

    exec = vi.fn(
      (
        _command: string,
        callback: (
          error?: Error,
          stream?: InstanceType<typeof EventEmitter> & {
            stderr: InstanceType<typeof EventEmitter>;
          },
        ) => void,
      ) => {
        const stream = new EventEmitter() as InstanceType<
          typeof EventEmitter
        > & {
          stderr: InstanceType<typeof EventEmitter>;
        };
        stream.stderr = new EventEmitter();
        sshMocks.activeStream = stream;
        callback(undefined, stream);
      },
    );
  }

  return {
    Client: vi.fn(() => {
      const client = new FakeClient();
      sshMocks.clients.push(client);
      return client;
    }),
  };
});

vi.mock("ssh2-sftp-client", () => ({
  default: vi.fn(),
}));

describe("SshClient.exec", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/otto";
    process.env.SSH_AUTH_SOCK = "/tmp/agent.sock";
    const { __testing } = await import("../env");
    __testing.resetEnvCacheForTests();
  });

  afterEach(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.SSH_AUTH_SOCK;
    const { __testing } = await import("../env");
    __testing.resetEnvCacheForTests();
    sshMocks.activeStream = null;
    sshMocks.clients.length = 0;
    vi.clearAllMocks();
  });

  it("rejects when the SSH exec stream emits an error", async () => {
    const { SshClient } = await import("./client");
    const sshClient = new SshClient();

    const execPromise = sshClient.exec(
      {
        host: "tenant.test",
      },
      "cloud-init status --wait",
    );

    await vi.waitFor(() => {
      expect(sshMocks.activeStream).toBeTruthy();
    });

    expect(() => {
      sshMocks.activeStream?.emit("error", new Error("channel lost"));
    }).not.toThrow();

    await expect(execPromise).rejects.toThrow("channel lost");
  });
});
