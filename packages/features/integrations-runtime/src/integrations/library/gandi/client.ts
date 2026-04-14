type GandiAvailabilityStatus =
  | "available"
  | "available_preorder"
  | "available_reserved"
  | "error_eoi"
  | "error_invalid"
  | "error_ratelimited"
  | "error_refused"
  | "error_timeout"
  | "error_unknown"
  | "pending"
  | "reserved_corporate"
  | "unavailable"
  | "unavailable_premium"
  | "unavailable_restricted"
  | (string & {});

export type GandiAvailabilityResult = {
  availability: "available" | "pending" | "unavailable" | "unknown";
  currentPhase: string | null;
  domain: string;
  prices: GandiRegistrationPrice[];
  status: GandiAvailabilityStatus;
};

export type GandiRegistrationPrice = {
  action: string | null;
  currency: string | null;
  durationUnit: string | null;
  maxDuration: number | null;
  minDuration: number | null;
  period: string | null;
  priceAfterTaxes: number | null;
  priceBeforeTaxes: number | null;
  priceType: string | null;
};

export type GandiTldMetadata = {
  authInfoRequiredForTransfer: boolean | null;
  canChangeOwner: boolean | null;
  canTradeExternally: boolean | null;
  category: string | null;
  corporate: boolean | null;
  fullName: string | null;
  href: string | null;
  lockSupported: boolean | null;
  name: string | null;
};

export type GandiRegistrationMetadata = {
  availability: string | null;
  currentPhase: string | null;
  domain: string;
  prices: GandiRegistrationPrice[];
  tld: GandiTldMetadata | null;
};

export type GandiDomainDetails = {
  createdAt: string | null;
  domain: string;
  expiresAt: string | null;
  fqdnUnicode: string | null;
  hasLiveDns: boolean | null;
  nameservers: string[];
  rawStatus: string[];
  tags: string[];
  updatedAt: string | null;
};

export type GandiDnsZone = {
  automaticSnapshots: boolean | null;
  domain: string;
  domainHref: string | null;
  domainKeysHref: string | null;
  domainRecordsHref: string | null;
  nameservers: string[];
};

export type GandiDnsRecord = {
  href: string | null;
  name: string;
  ttl: number | null;
  type: string;
  values: string[];
};

export type GandiDnsRecordList = {
  domain: string;
  filteredCount: number | null;
  records: GandiDnsRecord[];
  totalCount: number | null;
};

type GandiApiErrorPayload = {
  cause?: unknown;
  code?: unknown;
  message?: unknown;
  object?: unknown;
};

export class GandiApiError extends Error {
  readonly causeCode: string | null;
  readonly providerCode: number | null;
  readonly providerObject: string | null;
  readonly rateLimited: boolean;
  readonly status: number;
  readonly transient: boolean;

  constructor(input: {
    cause?: string | null;
    code?: number | null;
    message: string;
    object?: string | null;
    rateLimited?: boolean;
    status: number;
    transient?: boolean;
  }) {
    super(`Gandi API request failed with status ${input.status}: ${input.message}`);
    this.name = "GandiApiError";
    this.causeCode = input.cause ?? null;
    this.providerCode = input.code ?? null;
    this.providerObject = input.object ?? null;
    this.rateLimited = input.rateLimited ?? false;
    this.status = input.status;
    this.transient = input.transient ?? false;
  }
}

type GandiAvailabilityProduct = {
  name?: unknown;
  periods?: unknown;
  prices?: unknown;
  process?: unknown;
  status?: unknown;
};

type GandiAvailabilityResponse = {
  currency?: unknown;
  products?: unknown;
};

type GandiTldResponse = {
  authinfo_for_transfer?: unknown;
  category?: unknown;
  change_owner?: unknown;
  corporate?: unknown;
  ext_trade?: unknown;
  full_tld?: unknown;
  href?: unknown;
  lock?: unknown;
  name?: unknown;
};

type GandiDomainDetailsResponse = {
  dates?: unknown;
  fqdn?: unknown;
  fqdn_unicode?: unknown;
  nameservers?: unknown;
  services?: unknown;
  status?: unknown;
  tags?: unknown;
};

type GandiLiveDnsDomainResponse = {
  automatic_snapshots?: unknown;
  domain_href?: unknown;
  domain_keys_href?: unknown;
  domain_records_href?: unknown;
  fqdn?: unknown;
};

type GandiLiveDnsRecordResponse = {
  rrset_href?: unknown;
  rrset_name?: unknown;
  rrset_ttl?: unknown;
  rrset_type?: unknown;
  rrset_values?: unknown;
};

const DEFAULT_GANDI_API_BASE_URL = "https://api.gandi.net/v5";

export async function checkGandiDomainAvailability(domains: string[]) {
  const normalizedDomains = domains.map(normalizeDomain).filter(Boolean);

  if (normalizedDomains.length === 0) {
    return [];
  }

  return Promise.all(
    normalizedDomains.map(async (domain) => {
      const response = await fetchGandiJson<GandiAvailabilityResponse>(
        `/domain/check?name=${encodeURIComponent(domain)}&processes=create`,
      );

      const product = findAvailabilityProduct(response, domain);

      return normalizeAvailabilityResult({
        domain,
        product,
        response,
      });
    }),
  );
}

export async function getGandiDomainRegistrationMetadata(domain: string) {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    throw new Error("domain is required");
  }

  const [availabilityResponse, tldResponse] = await Promise.all([
    fetchGandiJson<GandiAvailabilityResponse>(
      `/domain/check?name=${encodeURIComponent(normalizedDomain)}&processes=create`,
    ),
    fetchGandiJson<GandiTldResponse>(`/domain/tlds/${encodeURIComponent(inferTld(normalizedDomain) ?? normalizedDomain)}`),
  ]);

  const product = findAvailabilityProduct(availabilityResponse, normalizedDomain);

  return {
    availability: typeof product?.status === "string" ? product.status : null,
    currentPhase: inferCurrentPhase(product),
    domain: normalizedDomain,
    prices: normalizeRegistrationPrices(product, availabilityResponse),
    tld: normalizeTldMetadata(tldResponse),
  } satisfies GandiRegistrationMetadata;
}

export async function getGandiDomainDetails(domain: string) {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    throw new Error("domain is required");
  }

  const response = await fetchGandiJson<GandiDomainDetailsResponse>(
    `/domain/domains/${encodeURIComponent(normalizedDomain)}`,
  );
  const dates = toRecord(response.dates);
  const nameservers = toRecord(response.nameservers);
  const services = toRecord(response.services);

  return {
    createdAt: typeof dates.created_at === "string" ? dates.created_at : null,
    domain: typeof response.fqdn === "string" ? response.fqdn : normalizedDomain,
    expiresAt: typeof dates.expires_at === "string" ? dates.expires_at : null,
    fqdnUnicode:
      typeof response.fqdn_unicode === "string" ? response.fqdn_unicode : null,
    hasLiveDns: typeof services.livedns === "boolean" ? services.livedns : null,
    nameservers: Array.isArray(nameservers.current)
      ? nameservers.current.filter((value): value is string => typeof value === "string")
      : [],
    rawStatus: Array.isArray(response.status)
      ? response.status.filter((value): value is string => typeof value === "string")
      : [],
    tags: Array.isArray(response.tags)
      ? response.tags.filter((value): value is string => typeof value === "string")
      : [],
    updatedAt: typeof dates.updated_at === "string" ? dates.updated_at : null,
  } satisfies GandiDomainDetails;
}

export async function getGandiDnsZone(domain: string) {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    throw new Error("domain is required");
  }

  const [domainResponse, nameserversResponse] = await Promise.all([
    fetchGandiJson<GandiLiveDnsDomainResponse>(
      `/livedns/domains/${encodeURIComponent(normalizedDomain)}`,
    ),
    fetchGandiJson<unknown[]>(
      `/livedns/domains/${encodeURIComponent(normalizedDomain)}/nameservers`,
    ),
  ]);

  return {
    automaticSnapshots:
      typeof domainResponse.automatic_snapshots === "boolean"
        ? domainResponse.automatic_snapshots
        : null,
    domain:
      typeof domainResponse.fqdn === "string"
        ? domainResponse.fqdn
        : normalizedDomain,
    domainHref:
      typeof domainResponse.domain_href === "string"
        ? domainResponse.domain_href
        : null,
    domainKeysHref:
      typeof domainResponse.domain_keys_href === "string"
        ? domainResponse.domain_keys_href
        : null,
    domainRecordsHref:
      typeof domainResponse.domain_records_href === "string"
        ? domainResponse.domain_records_href
        : null,
    nameservers: Array.isArray(nameserversResponse)
      ? nameserversResponse.filter((value): value is string => typeof value === "string")
      : [],
  } satisfies GandiDnsZone;
}

export async function listGandiDnsRecords(domain: string) {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    throw new Error("domain is required");
  }

  const { data, response } = await fetchGandiJsonWithResponse<
    GandiLiveDnsRecordResponse[]
  >(`/livedns/domains/${encodeURIComponent(normalizedDomain)}/records`);

  return {
    domain: normalizedDomain,
    filteredCount: parseCountHeader(response.headers.get("filtered-count")),
    records: Array.isArray(data) ? data.map(normalizeDnsRecord) : [],
    totalCount: parseCountHeader(response.headers.get("total-count")),
  } satisfies GandiDnsRecordList;
}

async function fetchGandiJson<T>(path: string): Promise<T> {
  const { data } = await fetchGandiJsonWithResponse<T>(path);

  return data;
}

async function fetchGandiJsonWithResponse<T>(path: string): Promise<{
  data: T;
  response: Response;
}> {
  const response = await fetch(`${getGandiApiBaseUrl()}${path}`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${getGandiApiToken()}`,
    },
    method: "GET",
  });

  if (!response.ok) {
    let errorPayload: GandiApiErrorPayload | null = null;

    try {
      errorPayload = (await response.json()) as GandiApiErrorPayload;
    } catch {
      errorPayload = null;
    }

    const message =
      errorPayload && typeof errorPayload.message === "string"
        ? errorPayload.message
        : `HTTP ${response.status}`;

    const cause =
      errorPayload && typeof errorPayload.cause === "string"
        ? errorPayload.cause
        : null;
    const code =
      errorPayload && typeof errorPayload.code === "number"
        ? errorPayload.code
        : null;
    const object =
      errorPayload && typeof errorPayload.object === "string"
        ? errorPayload.object
        : null;

    throw new GandiApiError({
      cause,
      code,
      message,
      object,
      rateLimited: response.status === 429 || cause === "rate_limited",
      status: response.status,
      transient:
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500 ||
        cause === "rate_limited" ||
        cause === "upstream_timeout",
    });
  }

  return {
    data: (await response.json()) as T,
    response,
  };
}

function findAvailabilityProduct(
  response: GandiAvailabilityResponse,
  domain: string,
): GandiAvailabilityProduct | null {
  const products = Array.isArray(response.products) ? response.products : [];

  return (
    products.find((product) => {
      const record = toRecord(product);
      return record.process === "create" && record.name === domain;
    }) ?? null
  );
}

function normalizeRegistrationPrices(
  product: GandiAvailabilityProduct | null,
  response: GandiAvailabilityResponse,
): GandiRegistrationPrice[] {
  const prices = Array.isArray(product?.prices) ? product.prices : [];
  const currency = typeof response.currency === "string" ? response.currency : null;
  const action = typeof product?.process === "string" ? product.process : null;

  return prices.map((value) => {
    const record = toRecord(value);
    const options = toRecord(record.options);

    return {
      action,
      currency,
      durationUnit:
        typeof record.duration_unit === "string" ? record.duration_unit : null,
      maxDuration:
        typeof record.max_duration === "number" ? record.max_duration : null,
      minDuration:
        typeof record.min_duration === "number" ? record.min_duration : null,
      period: typeof options.period === "string" ? options.period : null,
      priceAfterTaxes:
        typeof record.price_after_taxes === "number"
          ? record.price_after_taxes
          : null,
      priceBeforeTaxes:
        typeof record.price_before_taxes === "number"
          ? record.price_before_taxes
          : null,
      priceType: typeof record.type === "string" ? record.type : null,
    } satisfies GandiRegistrationPrice;
  });
}

function inferCurrentPhase(product: GandiAvailabilityProduct | null) {
  const periods = Array.isArray(product?.periods) ? product.periods : [];
  const firstPeriod = periods[0];
  const record = toRecord(firstPeriod);

  return typeof record.name === "string" ? record.name : null;
}

function normalizeAvailabilityResult(input: {
  domain: string;
  product: GandiAvailabilityProduct | null;
  response: GandiAvailabilityResponse;
}): GandiAvailabilityResult {
  const status = normalizeAvailabilityStatus(
    typeof input.product?.status === "string"
      ? input.product.status
      : "error_unknown",
  );

  return {
    availability: bucketAvailabilityStatus(status),
    currentPhase: inferCurrentPhase(input.product),
    domain: input.domain,
    prices: normalizeRegistrationPrices(input.product, input.response),
    status,
  };
}

function normalizeDnsRecord(record: GandiLiveDnsRecordResponse): GandiDnsRecord {
  return {
    href: typeof record.rrset_href === "string" ? record.rrset_href : null,
    name: typeof record.rrset_name === "string" ? record.rrset_name : "@",
    ttl: typeof record.rrset_ttl === "number" ? record.rrset_ttl : null,
    type: typeof record.rrset_type === "string" ? record.rrset_type : "UNKNOWN",
    values: Array.isArray(record.rrset_values)
      ? record.rrset_values.filter((value): value is string => typeof value === "string")
      : [],
  };
}

function normalizeTldMetadata(response: GandiTldResponse): GandiTldMetadata {
  return {
    authInfoRequiredForTransfer:
      typeof response.authinfo_for_transfer === "boolean"
        ? response.authinfo_for_transfer
        : null,
    canChangeOwner:
      typeof response.change_owner === "boolean" ? response.change_owner : null,
    canTradeExternally:
      typeof response.ext_trade === "boolean" ? response.ext_trade : null,
    category: typeof response.category === "string" ? response.category : null,
    corporate:
      typeof response.corporate === "boolean" ? response.corporate : null,
    fullName: typeof response.full_tld === "string" ? response.full_tld : null,
    href: typeof response.href === "string" ? response.href : null,
    lockSupported: typeof response.lock === "boolean" ? response.lock : null,
    name: typeof response.name === "string" ? response.name : null,
  };
}

function getGandiApiToken() {
  const token = process.env.GANDI_API_TOKEN?.trim();

  if (!token) {
    throw new Error("GANDI_API_TOKEN is required");
  }

  return token;
}

function getGandiApiBaseUrl() {
  const baseUrl = process.env.GANDI_BASE_URL?.trim() || DEFAULT_GANDI_API_BASE_URL;
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function parseCountHeader(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeAvailabilityStatus(value: string): GandiAvailabilityStatus {
  return value.trim().toLowerCase() as GandiAvailabilityStatus;
}

function bucketAvailabilityStatus(
  status: GandiAvailabilityStatus,
): GandiAvailabilityResult["availability"] {
  if (
    status === "available" ||
    status === "available_preorder" ||
    status === "available_reserved" ||
    status === "reserved_corporate"
  ) {
    return "available";
  }

  if (status === "pending") {
    return "pending";
  }

  if (
    status === "unavailable" ||
    status === "unavailable_premium" ||
    status === "unavailable_restricted" ||
    status.startsWith("error_")
  ) {
    return "unavailable";
  }

  return "unknown";
}

function normalizeDomain(value: string) {
  return value.trim().toLowerCase();
}

function inferTld(domain: string) {
  const parts = domain.split(".");
  return parts.length >= 2 ? parts.at(-1) ?? null : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
