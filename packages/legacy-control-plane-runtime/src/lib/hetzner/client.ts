import { getEnv } from "../env";

export type HetznerCreateServerInput = {
  image: string;
  labels?: Record<string, string>;
  location: string;
  name: string;
  serverType: string;
  sshKeys?: string[];
  startAfterCreate?: boolean;
  userData: string;
};

export type HetznerServer = {
  actionId: string | null;
  id: string;
  image: string | null;
  ipv4: string | null;
  ipv6: string | null;
  labels: Record<string, string>;
  location: string | null;
  name: string;
  serverType: string | null;
  status: string;
};

type HetznerActionResponse = {
  action?: {
    error?: {
      code?: string;
      message?: string;
    } | null;
    id: number;
    progress?: number;
    status: string;
  };
};

type HetznerErrorShape = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class HetznerApiError extends Error {
  code?: string;
  responseStatus: number;

  constructor(input: {
    code?: string;
    message: string;
    responseStatus: number;
  }) {
    super(input.message);
    this.code = input.code;
    this.name = "HetznerApiError";
    this.responseStatus = input.responseStatus;
  }
}

export class HetznerClient {
  private readonly actionTimeoutMs: number;
  private readonly apiBaseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly token: string;

  constructor() {
    const env = getEnv();

    if (!env.HETZNER_API_TOKEN) {
      throw new Error(
        "HETZNER_API_TOKEN is required to use the Hetzner client",
      );
    }

    this.actionTimeoutMs = env.HETZNER_ACTION_TIMEOUT_MS;
    this.apiBaseUrl = env.HETZNER_API_BASE_URL;
    this.pollIntervalMs = env.HETZNER_POLL_INTERVAL_MS;
    this.token = env.HETZNER_API_TOKEN;
  }

  async createServer(input: HetznerCreateServerInput): Promise<HetznerServer> {
    await this.validateServerTypeLocation(input.serverType, input.location);

    const payload = {
      image: input.image,
      labels: input.labels,
      location: input.location,
      name: input.name,
      server_type: input.serverType,
      ssh_keys: input.sshKeys,
      start_after_create: input.startAfterCreate ?? true,
      user_data: input.userData,
    };

    const response = await this.request<{
      action?: { id: number } | null;
      server: HetznerServerResponse;
    }>("/servers", {
      body: JSON.stringify(payload),
      method: "POST",
    });

    return normalizeHetznerServer(response.server, response.action?.id ?? null);
  }

  async deleteServer(serverId: string): Promise<void> {
    await this.request(`/servers/${serverId}`, {
      method: "DELETE",
    });
  }

  async getServer(serverId: string): Promise<HetznerServer> {
    const response = await this.request<{ server: HetznerServerResponse }>(
      `/servers/${serverId}`,
    );

    return normalizeHetznerServer(response.server, null);
  }

  async listServers(filters?: {
    labelSelector?: string;
    name?: string;
  }): Promise<HetznerServer[]> {
    const searchParams = new URLSearchParams();

    if (filters?.labelSelector) {
      searchParams.set("label_selector", filters.labelSelector);
    }

    if (filters?.name) {
      searchParams.set("name", filters.name);
    }

    const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
    const response = await this.request<{ servers: HetznerServerResponse[] }>(
      `/servers${suffix}`,
    );

    return response.servers.map((server) =>
      normalizeHetznerServer(server, null),
    );
  }

  async validateServerTypeLocation(
    serverTypeName: string,
    locationName: string,
  ): Promise<void> {
    const searchParams = new URLSearchParams({
      name: serverTypeName,
    });
    const response = await this.request<{
      server_types: HetznerServerTypeResponse[];
    }>(`/server_types?${searchParams.toString()}`);
    const serverType = response.server_types.find(
      (candidate) => candidate.name === serverTypeName,
    );

    if (!serverType) {
      throw new Error(`Hetzner server type ${serverTypeName} was not found`);
    }

    const availableLocations = serverType.locations
      .filter((location) => isLocationCurrentlyAvailable(location.deprecation))
      .map((location) => location.name);

    if (!availableLocations.includes(locationName)) {
      throw new Error(
        `Hetzner server type ${serverTypeName} is not currently available in ${locationName}. Available locations: ${availableLocations.join(", ") || "none"}`,
      );
    }
  }

  async rebootServer(serverId: string): Promise<string | null> {
    const response = await this.request<{ action?: { id: number } | null }>(
      `/servers/${serverId}/actions/reboot`,
      {
        method: "POST",
      },
    );

    return response.action ? String(response.action.id) : null;
  }

  async waitForServerAction(serverId: string, actionId: string): Promise<void> {
    const deadline = Date.now() + this.actionTimeoutMs;

    while (Date.now() < deadline) {
      const response = await this.request<HetznerActionResponse>(
        `/actions/${actionId}`,
      );

      const action = response.action;

      if (!action) {
        throw new Error(
          `Hetzner action ${actionId} was missing from the response`,
        );
      }

      if (action.status === "success") {
        return;
      }

      if (action.status === "error") {
        throw new HetznerApiError({
          code: action.error?.code,
          message:
            action.error?.message ??
            `Hetzner action ${actionId} failed for server ${serverId}`,
          responseStatus: 409,
        });
      }

      await sleep(this.pollIntervalMs);
    }

    throw new Error(
      `Hetzner action ${actionId} did not finish within ${this.actionTimeoutMs}ms`,
    );
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      let errorMessage = `Hetzner API request failed with ${response.status}`;
      let errorCode: string | undefined;

      try {
        const errorJson = (await response.json()) as HetznerErrorShape;
        errorCode = errorJson.error?.code;
        errorMessage = errorJson.error?.message ?? errorMessage;
      } catch {
        // Keep the default message if the response cannot be parsed.
      }

      throw new HetznerApiError({
        code: errorCode,
        message: errorMessage,
        responseStatus: response.status,
      });
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }
}

type HetznerServerResponse = {
  id: number;
  image?: {
    name?: string | null;
  } | null;
  labels?: Record<string, string> | null;
  location?: {
    name?: string | null;
  } | null;
  name: string;
  public_net?: {
    ipv4?: {
      ip?: string | null;
    } | null;
    ipv6?: {
      ip?: string | null;
    } | null;
  } | null;
  server_type?: {
    name?: string | null;
  } | null;
  status: string;
};

type HetznerServerTypeResponse = {
  locations: Array<{
    deprecation?: {
      announced?: string | null;
      unavailable_after?: string | null;
    } | null;
    name: string;
  }>;
  name: string;
};

function normalizeHetznerServer(
  server: HetznerServerResponse,
  actionId: number | null,
): HetznerServer {
  return {
    actionId: actionId === null ? null : String(actionId),
    id: String(server.id),
    image: server.image?.name ?? null,
    ipv4: server.public_net?.ipv4?.ip ?? null,
    ipv6: server.public_net?.ipv6?.ip ?? null,
    labels: server.labels ?? {},
    location: server.location?.name ?? null,
    name: server.name,
    serverType: server.server_type?.name ?? null,
    status: server.status,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLocationCurrentlyAvailable(
  deprecation:
    | {
        unavailable_after?: string | null;
      }
    | null
    | undefined,
) {
  if (!deprecation?.unavailable_after) {
    return true;
  }

  return new Date(deprecation.unavailable_after).getTime() > Date.now();
}
