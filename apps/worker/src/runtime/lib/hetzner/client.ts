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

export type HetznerCreateServerFromSnapshotInput = {
  image: string;
  labels?: Record<string, string>;
  location: string;
  name: string;
  serverType: string;
  sshKeys?: string[];
  startAfterCreate?: boolean;
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

export type HetznerImage = {
  architecture: string | null;
  description: string | null;
  id: string;
  name: string | null;
  osFlavor: string | null;
  rapidDeploy: boolean;
  status: string | null;
  type: string | null;
};

export type HetznerSnapshot = {
  actionId: string | null;
  id: string;
};

export type HetznerActionStatus = {
  errorCode: string | null;
  errorMessage: string | null;
  id: string;
  progress: number | null;
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

  async createServerFromSnapshot(
    input: HetznerCreateServerFromSnapshotInput,
  ): Promise<HetznerServer> {
    const image = await this.getImage(input.image);

    if (image.type !== "snapshot") {
      throw new Error(
        `Hetzner image ${input.image} is not a snapshot (got ${image.type ?? "unknown"})`,
      );
    }

    await this.validateServerTypeLocation(
      input.serverType,
      input.location,
      image.architecture,
    );

    const response = await this.request<{
      action?: { id: number } | null;
      server: HetznerServerResponse;
    }>("/servers", {
      body: JSON.stringify({
        image: input.image,
        labels: input.labels,
        location: input.location,
        name: input.name,
        server_type: input.serverType,
        ssh_keys: input.sshKeys,
        start_after_create: input.startAfterCreate ?? true,
      }),
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

  async getImage(image: string): Promise<HetznerImage> {
    if (isNumericIdentifier(image)) {
      const response = await this.request<{ image: HetznerImageResponse }>(
        `/images/${image}`,
      );

      return normalizeHetznerImage(response.image);
    }

    const searchParams = new URLSearchParams({
      name: image,
    });
    const response = await this.request<{ images: HetznerImageResponse[] }>(
      `/images?${searchParams.toString()}`,
    );
    const exactMatch = response.images.find((candidate) => candidate.name === image);

    if (!exactMatch) {
      throw new Error(`Hetzner image ${image} was not found`);
    }

    return normalizeHetznerImage(exactMatch);
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
    requiredArchitecture?: string | null,
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

    if (
      requiredArchitecture &&
      serverType.architecture &&
      serverType.architecture !== requiredArchitecture
    ) {
      throw new Error(
        `Hetzner server type ${serverTypeName} uses ${serverType.architecture}, which does not match image architecture ${requiredArchitecture}`,
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

  async powerOffServer(serverId: string): Promise<string | null> {
    const response = await this.request<{ action?: { id: number } | null }>(
      `/servers/${serverId}/actions/poweroff`,
      {
        method: "POST",
      },
    );

    return response.action ? String(response.action.id) : null;
  }

  async createSnapshot(
    serverId: string,
    description: string,
  ): Promise<HetznerSnapshot> {
    const response = await this.request<{
      action?: { id: number } | null;
      image?: { id: number } | null;
    }>(`/servers/${serverId}/actions/create_image`, {
      body: JSON.stringify({
        description,
        type: "snapshot",
      }),
      method: "POST",
    });

    if (!response.image?.id) {
      throw new Error(`Hetzner snapshot creation did not return an image id`);
    }

    return {
      actionId: response.action ? String(response.action.id) : null,
      id: String(response.image.id),
    };
  }

  async waitForServerAction(serverId: string, actionId: string): Promise<void> {
    const deadline = Date.now() + this.actionTimeoutMs;

    while (Date.now() < deadline) {
      const action = await this.getAction(actionId);

      if (action.status === "success") {
        return;
      }

      if (action.status === "error") {
        throw new HetznerApiError({
          code: action.errorCode ?? undefined,
          message:
            action.errorMessage ??
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

  async getAction(actionId: string): Promise<HetznerActionStatus> {
    const response = await this.request<HetznerActionResponse>(
      `/actions/${actionId}`,
    );

    const action = response.action;

    if (!action) {
      throw new Error(`Hetzner action ${actionId} was missing from the response`);
    }

    return {
      errorCode: action.error?.code ?? null,
      errorMessage: action.error?.message ?? null,
      id: String(action.id),
      progress: action.progress ?? null,
      status: action.status,
    };
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

type HetznerImageResponse = {
  architecture?: string | null;
  description?: string | null;
  id: number;
  name?: string | null;
  os_flavor?: string | null;
  rapid_deploy?: boolean | null;
  status?: string | null;
  type?: string | null;
};

type HetznerServerTypeResponse = {
  architecture?: string | null;
  locations: Array<{
    deprecation?: {
      announced?: string | null;
      unavailable_after?: string | null;
    } | null;
    name: string;
  }>;
  name: string;
};

function normalizeHetznerImage(image: HetznerImageResponse): HetznerImage {
  return {
    architecture: image.architecture ?? null,
    description: image.description ?? null,
    id: String(image.id),
    name: image.name ?? null,
    osFlavor: image.os_flavor ?? null,
    rapidDeploy: image.rapid_deploy ?? false,
    status: image.status ?? null,
    type: image.type ?? null,
  };
}

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

function isNumericIdentifier(value: string) {
  return /^\d+$/.test(value);
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
