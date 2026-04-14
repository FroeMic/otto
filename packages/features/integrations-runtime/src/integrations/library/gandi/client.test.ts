import assert from "node:assert/strict";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkGandiDomainAvailability,
  getGandiDomainDetails,
  getGandiDomainRegistrationMetadata,
} from "./client";

const originalToken = process.env.GANDI_API_TOKEN;
const originalBaseUrl = process.env.GANDI_BASE_URL;

describe("gandi client", () => {
  afterEach(() => {
    vi.restoreAllMocks();

    if (originalToken === undefined) {
      delete process.env.GANDI_API_TOKEN;
    } else {
      process.env.GANDI_API_TOKEN = originalToken;
    }

    if (originalBaseUrl === undefined) {
      delete process.env.GANDI_BASE_URL;
    } else {
      process.env.GANDI_BASE_URL = originalBaseUrl;
    }
  });

  it("checks domain availability through the v5 domain check endpoint and returns coarse and raw registration state", async () => {
    process.env.GANDI_API_TOKEN = "gandi_test_token";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            currency: "EUR",
            grid: "A",
            products: [
              {
                name: "ledgerpilot.com",
                prices: [
                  {
                    duration_unit: "y",
                    max_duration: 1,
                    min_duration: 1,
                    price_after_taxes: 14.98,
                    price_before_taxes: 12.48,
                    type: "standard",
                  },
                ],
                process: "create",
                status: "unavailable",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
        JSON.stringify({
          currency: "EUR",
          grid: "A",
          products: [
            {
              name: "ledgerpilot.ai",
              periods: [
                {
                  name: "sunrise",
                },
              ],
              prices: [
                {
                  duration_unit: "y",
                  max_duration: 1,
                  min_duration: 1,
                  options: {
                    period: "sunrise",
                  },
                  price_after_taxes: 79,
                  price_before_taxes: 79,
                  type: "premium",
                },
              ],
              process: "create",
              status: "available_reserved",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ));

    const result = await checkGandiDomainAvailability([
      "ledgerpilot.com",
      "ledgerpilot.ai",
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.gandi.net/v5/domain/check?name=ledgerpilot.com&processes=create",
      {
        headers: {
          authorization: "Bearer gandi_test_token",
          accept: "application/json",
        },
        method: "GET",
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.gandi.net/v5/domain/check?name=ledgerpilot.ai&processes=create",
      {
        headers: {
          authorization: "Bearer gandi_test_token",
          accept: "application/json",
        },
        method: "GET",
      },
    );
    assert.deepEqual(result, [
      {
        availability: "unavailable",
        currentPhase: null,
        domain: "ledgerpilot.com",
        prices: [
          {
            action: "create",
            currency: "EUR",
            durationUnit: "y",
            maxDuration: 1,
            minDuration: 1,
            period: null,
            priceAfterTaxes: 14.98,
            priceBeforeTaxes: 12.48,
            priceType: "standard",
          },
        ],
        status: "unavailable",
      },
      {
        availability: "available",
        currentPhase: "sunrise",
        domain: "ledgerpilot.ai",
        prices: [
          {
            action: "create",
            currency: "EUR",
            durationUnit: "y",
            maxDuration: 1,
            minDuration: 1,
            period: "sunrise",
            priceAfterTaxes: 79,
            priceBeforeTaxes: 79,
            priceType: "premium",
          },
        ],
        status: "available_reserved",
      },
    ]);
  });

  it("reads registration metadata from the v5 domain check and tld endpoints and normalizes pricing rows", async () => {
    process.env.GANDI_API_TOKEN = "gandi_test_token";
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          currency: "EUR",
          grid: "A",
          products: [
            {
              name: "ledgerpilot.ai",
              periods: [
                {
                  name: "golive",
                  starts_at: "2026-01-01T00:00:00Z",
                },
              ],
              prices: [
                {
                  duration_unit: "y",
                  max_duration: 1,
                  min_duration: 1,
                  options: {
                    period: "golive",
                  },
                  price_after_taxes: 79,
                  price_before_taxes: 79,
                  type: "standard",
                },
              ],
              process: "create",
              status: "available",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authinfo_for_transfer: true,
          category: "ccTLD",
          change_owner: true,
          corporate: false,
          ext_trade: true,
          full_tld: "ai",
          href: "https://api.gandi.net/v5/domain/tlds/ai",
          lock: false,
          name: "ai",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await getGandiDomainRegistrationMetadata("ledgerpilot.ai");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    assert.deepEqual(result, {
      availability: "available",
      currentPhase: "golive",
      domain: "ledgerpilot.ai",
      prices: [
        {
          action: "create",
          currency: "EUR",
          durationUnit: "y",
          maxDuration: 1,
          minDuration: 1,
          period: "golive",
          priceAfterTaxes: 79,
          priceBeforeTaxes: 79,
          priceType: "standard",
        },
      ],
      tld: {
        authInfoRequiredForTransfer: true,
        canChangeOwner: true,
        canTradeExternally: true,
        category: "ccTLD",
        corporate: false,
        fullName: "ai",
        href: "https://api.gandi.net/v5/domain/tlds/ai",
        lockSupported: false,
        name: "ai",
      },
    });
  });

  it("reads managed domain details from the v5 domain details endpoint", async () => {
    process.env.GANDI_API_TOKEN = "gandi_test_token";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          fqdn: "ledgerpilot.ai",
          fqdn_unicode: "ledgerpilot.ai",
          dates: {
            created_at: "2026-01-02T03:04:05Z",
            expires_at: "2027-01-02T03:04:05Z",
            updated_at: "2026-02-03T04:05:06Z",
          },
          nameservers: {
            current: ["ns-1-a.gandi.net", "ns-1-b.gandi.net"],
          },
          services: {
            livedns: true,
          },
          status: ["clientTransferProhibited"],
          tags: ["startup"],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await getGandiDomainDetails("ledgerpilot.ai");

    assert.deepEqual(result, {
      createdAt: "2026-01-02T03:04:05Z",
      domain: "ledgerpilot.ai",
      expiresAt: "2027-01-02T03:04:05Z",
      fqdnUnicode: "ledgerpilot.ai",
      hasLiveDns: true,
      nameservers: ["ns-1-a.gandi.net", "ns-1-b.gandi.net"],
      rawStatus: ["clientTransferProhibited"],
      tags: ["startup"],
      updatedAt: "2026-02-03T04:05:06Z",
    });
  });

  it("throws a structured error when the v5 api returns an error payload", async () => {
    process.env.GANDI_API_TOKEN = "gandi_test_token";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          cause: "invalid_parameter",
          code: 400,
          message: "invalid domain",
          object: "DomainCheck",
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      checkGandiDomainAvailability(["not a domain"]),
    ).rejects.toThrow(
      "Gandi API request failed with status 400: invalid domain",
    );
  });
});
