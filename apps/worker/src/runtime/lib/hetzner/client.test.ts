import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __testing as envTesting } from "../env";
import { HetznerClient } from "./client";

const BASE_ENV = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/otto",
  HETZNER_API_TOKEN: "hetzner-test-token",
} as const;

describe("HetznerClient snapshot support", () => {
  const fetchMock = vi.fn();
  const previousFetch = global.fetch;

  beforeEach(() => {
    Object.assign(process.env, BASE_ENV);
    envTesting.resetEnvCacheForTests();
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    global.fetch = previousFetch;
    delete process.env.DATABASE_URL;
    delete process.env.HETZNER_API_TOKEN;
    envTesting.resetEnvCacheForTests();
  });

  it("loads snapshot image metadata and normalizes its architecture and id", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          image: {
            architecture: "x86",
            description: "Otto onboarding snapshot",
            id: 1234,
            name: "otto-snapshot-2026-04-15",
            os_flavor: "ubuntu",
            rapid_deploy: false,
            status: "available",
            type: "snapshot",
          },
        }),
        { status: 200 },
      ),
    );

    const client = new HetznerClient();
    const image = await client.getImage("1234");

    expect(image).toEqual({
      architecture: "x86",
      description: "Otto onboarding snapshot",
      id: "1234",
      name: "otto-snapshot-2026-04-15",
      osFlavor: "ubuntu",
      rapidDeploy: false,
      status: "available",
      type: "snapshot",
    });
  });

  it("creates a server from a configured snapshot image", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            image: {
              architecture: "x86",
              id: 1234,
              name: "otto-snapshot-2026-04-15",
              status: "available",
              type: "snapshot",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            server_types: [
              {
                architecture: "x86",
                locations: [{ name: "ash" }],
                name: "cpx21",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            action: { id: 99 },
            server: {
              id: 42,
              image: { name: "otto-snapshot-2026-04-15" },
              labels: { "otto/managed": "true" },
              location: { name: "ash" },
              name: "otto-tenant",
              public_net: { ipv4: { ip: "1.2.3.4" } },
              server_type: { name: "cpx21" },
              status: "running",
            },
          }),
          { status: 200 },
        ),
      );

    const client = new HetznerClient();
    const server = await client.createServerFromSnapshot({
      image: "1234",
      labels: { "otto/managed": "true" },
      location: "ash",
      name: "otto-tenant",
      serverType: "cpx21",
      sshKeys: ["main"],
    });

    expect(server.id).toBe("42");
    expect(server.image).toBe("otto-snapshot-2026-04-15");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.hetzner.cloud/v1/servers",
      expect.objectContaining({
        body: JSON.stringify({
          image: "1234",
          labels: { "otto/managed": "true" },
          location: "ash",
          name: "otto-tenant",
          server_type: "cpx21",
          ssh_keys: ["main"],
          start_after_create: true,
        }),
        method: "POST",
      }),
    );
  });
});
