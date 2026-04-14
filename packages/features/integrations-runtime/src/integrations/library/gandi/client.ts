import { XMLParser } from "fast-xml-parser";

const GANDI_RPC_URL = "https://rpc.gandi.net/xmlrpc/";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

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
  availability: GandiAvailabilityStatus;
  domain: string;
};

export type GandiRegistrationPrice = {
  action: string | null;
  currency: string | null;
  durationUnit: string | null;
  maxDuration: number | null;
  minDuration: number | null;
  price: number | null;
};

export type GandiRegistrationMetadata = {
  availability: string | null;
  currentPhase: string | null;
  domain: string;
  prices: GandiRegistrationPrice[];
  tld: string | null;
};

export async function checkGandiDomainAvailability(domains: string[]) {
  const normalizedDomains = domains.map(normalizeDomain).filter(Boolean);

  if (normalizedDomains.length === 0) {
    return [];
  }

  const response = await callGandiXmlRpc("domain.available", [
    getGandiApiToken(),
    normalizedDomains,
  ]);

  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("Gandi availability response was not a struct.");
  }

  return normalizedDomains.map((domain) => ({
    availability: normalizeAvailabilityStatus(
      typeof response[domain] === "string" ? response[domain] : "error_unknown",
    ),
    domain,
  }));
}

export async function getGandiDomainRegistrationMetadata(domain: string) {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    throw new Error("domain is required");
  }

  const response = await callGandiXmlRpc("domain.price.list", [
    getGandiApiToken(),
    {
      name: [normalizedDomain],
    },
  ]);

  const entries = Array.isArray(response) ? response : [];
  const matchedEntry =
    entries.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.extension === "string" &&
        entry.extension.trim().toLowerCase() === normalizedDomain,
    ) ?? null;

  return {
    availability:
      matchedEntry && typeof matchedEntry.available === "string"
        ? matchedEntry.available
        : null,
    currentPhase:
      matchedEntry && typeof matchedEntry.current_phase === "string"
        ? matchedEntry.current_phase
        : null,
    domain: normalizedDomain,
    prices:
      matchedEntry && Array.isArray(matchedEntry.prices)
        ? matchedEntry.prices.map(normalizeRegistrationPrice)
        : [],
    tld:
      matchedEntry && typeof matchedEntry.name === "string"
        ? matchedEntry.name
        : inferTld(normalizedDomain),
  } satisfies GandiRegistrationMetadata;
}

export async function getGandiDomainDetails(domain: string) {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    throw new Error("domain is required");
  }

  const [availabilityResults, registrationMetadata] = await Promise.all([
    checkGandiDomainAvailability([normalizedDomain]),
    getGandiDomainRegistrationMetadata(normalizedDomain),
  ]);

  return {
    ...registrationMetadata,
    availability:
      availabilityResults[0]?.availability ?? registrationMetadata.availability,
  } satisfies GandiRegistrationMetadata;
}

function getGandiApiToken() {
  const token = process.env.GANDI_API_TOKEN?.trim();

  if (!token) {
    throw new Error("GANDI_API_TOKEN is required");
  }

  return token;
}

async function callGandiXmlRpc(methodName: string, params: unknown[]) {
  const response = await fetch(GANDI_RPC_URL, {
    body: buildXmlRpcRequest(methodName, params),
    headers: {
      "content-type": "text/xml",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      `Gandi XML-RPC request failed with status ${response.status}.`,
    );
  }

  const xml = await response.text();
  const parsed = xmlParser.parse(xml) as {
    methodResponse?: {
      fault?: {
        value?: unknown;
      };
      params?: {
        param?: {
          value?: unknown;
        };
      };
    };
  };

  if (parsed.methodResponse?.fault?.value) {
    const fault = parseXmlRpcValue(parsed.methodResponse.fault.value);
    throw new Error(
      `Gandi XML-RPC fault: ${JSON.stringify(fault)}`,
    );
  }

  return parseXmlRpcValue(parsed.methodResponse?.params?.param?.value);
}

function buildXmlRpcRequest(methodName: string, params: unknown[]) {
  return `<?xml version="1.0"?>
<methodCall>
  <methodName>${escapeXml(methodName)}</methodName>
  <params>${params
    .map(
      (param) => `
    <param>
      ${serializeXmlRpcValue(param)}
    </param>`,
    )
    .join("")}
  </params>
</methodCall>`;
}

function serializeXmlRpcValue(value: unknown): string {
  if (typeof value === "string") {
    return `<value><string>${escapeXml(value)}</string></value>`;
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? `<value><int>${value}</int></value>`
      : `<value><double>${value}</double></value>`;
  }

  if (typeof value === "boolean") {
    return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
  }

  if (Array.isArray(value)) {
    return `<value><array><data>${value
      .map((entry) => serializeXmlRpcValue(entry))
      .join("")}</data></array></value>`;
  }

  if (value && typeof value === "object") {
    return `<value><struct>${Object.entries(value)
      .map(
        ([key, entryValue]) => `<member>
  <name>${escapeXml(key)}</name>
  ${serializeXmlRpcValue(entryValue)}
</member>`,
      )
      .join("")}</struct></value>`;
  }

  return "<value><nil/></value>";
}

function parseXmlRpcValue(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value ?? null;
  }

  if (Array.isArray(value)) {
    return value.map(parseXmlRpcValue);
  }

  if ("string" in value && typeof value.string === "string") {
    return value.string;
  }

  if ("int" in value && typeof value.int === "string") {
    return Number.parseInt(value.int, 10);
  }

  if ("i4" in value && typeof value.i4 === "string") {
    return Number.parseInt(value.i4, 10);
  }

  if ("double" in value && typeof value.double === "string") {
    return Number.parseFloat(value.double);
  }

  if ("boolean" in value) {
    return value.boolean === "1" || value.boolean === 1;
  }

  if ("array" in value && value.array && typeof value.array === "object") {
    const data = (value.array as { data?: { value?: unknown } }).data?.value;
    const entries = Array.isArray(data) ? data : data === undefined ? [] : [data];
    return entries.map((entry) => parseXmlRpcValue(entry));
  }

  if ("struct" in value && value.struct && typeof value.struct === "object") {
    const members = (value.struct as { member?: unknown }).member;
    const memberList = Array.isArray(members)
      ? members
      : members === undefined
        ? []
        : [members];
    const result: Record<string, unknown> = {};

    for (const member of memberList) {
      if (!member || typeof member !== "object") {
        continue;
      }

      const name =
        "name" in member && typeof member.name === "string" ? member.name : null;

      if (!name || !("value" in member)) {
        continue;
      }

      result[name] = parseXmlRpcValue(member.value);
    }

    return result;
  }

  return null;
}

function normalizeRegistrationPrice(value: unknown): GandiRegistrationPrice {
  const record =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const actionRecord =
    record.action && typeof record.action === "object" && !Array.isArray(record.action)
      ? record.action
      : {};
  const firstUnitPrice = Array.isArray(record.unit_price)
    ? record.unit_price[0]
    : null;
  const unitPriceRecord =
    firstUnitPrice &&
    typeof firstUnitPrice === "object" &&
    !Array.isArray(firstUnitPrice)
      ? firstUnitPrice
      : {};

  return {
    action:
      typeof actionRecord.name === "string" ? actionRecord.name : null,
    currency:
      typeof unitPriceRecord.currency === "string"
        ? unitPriceRecord.currency
        : null,
    durationUnit:
      typeof unitPriceRecord.duration_unit === "string"
        ? unitPriceRecord.duration_unit
        : null,
    maxDuration:
      typeof unitPriceRecord.max_duration === "number"
        ? unitPriceRecord.max_duration
        : null,
    minDuration:
      typeof unitPriceRecord.min_duration === "number"
        ? unitPriceRecord.min_duration
        : null,
    price:
      typeof unitPriceRecord.price === "number" ? unitPriceRecord.price : null,
  };
}

function normalizeAvailabilityStatus(value: string): GandiAvailabilityStatus {
  return value.trim().toLowerCase() as GandiAvailabilityStatus;
}

function normalizeDomain(value: string) {
  return value.trim().toLowerCase();
}

function inferTld(domain: string) {
  const parts = domain.split(".");
  return parts.length >= 2 ? parts.at(-1) ?? null : null;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
