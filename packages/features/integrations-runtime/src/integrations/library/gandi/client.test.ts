import assert from "node:assert/strict";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkGandiDomainAvailability,
  getGandiDomainDetails,
  getGandiDomainRegistrationMetadata,
} from "./client";

const originalToken = process.env.GANDI_API_TOKEN;

describe("gandi client", () => {
  afterEach(() => {
    vi.restoreAllMocks();

    if (originalToken === undefined) {
      delete process.env.GANDI_API_TOKEN;
    } else {
      process.env.GANDI_API_TOKEN = originalToken;
    }
  });

  it("checks domain availability through Gandi's XML-RPC API and normalizes the result", async () => {
    process.env.GANDI_API_TOKEN = "gandi_test_token";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          `<?xml version="1.0"?>
          <methodResponse>
            <params>
              <param>
                <value>
                  <struct>
                    <member>
                      <name>ledgerpilot.com</name>
                      <value><string>unavailable</string></value>
                    </member>
                    <member>
                      <name>ledgerpilot.ai</name>
                      <value><string>available</string></value>
                    </member>
                  </struct>
                </value>
              </param>
            </params>
          </methodResponse>`,
          { status: 200 },
        ),
      );

    const result = await checkGandiDomainAvailability([
      "ledgerpilot.com",
      "ledgerpilot.ai",
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    assert.deepEqual(result, [
      {
        availability: "unavailable",
        domain: "ledgerpilot.com",
      },
      {
        availability: "available",
        domain: "ledgerpilot.ai",
      },
    ]);
  });

  it("reads registration metadata from Gandi's pricing API and normalizes pricing rows", async () => {
    process.env.GANDI_API_TOKEN = "gandi_test_token";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        `<?xml version="1.0"?>
        <methodResponse>
          <params>
            <param>
              <value>
                <array>
                  <data>
                    <value>
                      <struct>
                        <member>
                          <name>available</name>
                          <value><string>available</string></value>
                        </member>
                        <member>
                          <name>current_phase</name>
                          <value><string>golive</string></value>
                        </member>
                        <member>
                          <name>extension</name>
                          <value><string>ledgerpilot.ai</string></value>
                        </member>
                        <member>
                          <name>name</name>
                          <value><string>ai</string></value>
                        </member>
                        <member>
                          <name>prices</name>
                          <value>
                            <array>
                              <data>
                                <value>
                                  <struct>
                                    <member>
                                      <name>action</name>
                                      <value>
                                        <struct>
                                          <member>
                                            <name>name</name>
                                            <value><string>create</string></value>
                                          </member>
                                        </struct>
                                      </value>
                                    </member>
                                    <member>
                                      <name>unit_price</name>
                                      <value>
                                        <array>
                                          <data>
                                            <value>
                                              <struct>
                                                <member>
                                                  <name>currency</name>
                                                  <value><string>EUR</string></value>
                                                </member>
                                                <member>
                                                  <name>duration_unit</name>
                                                  <value><string>y</string></value>
                                                </member>
                                                <member>
                                                  <name>max_duration</name>
                                                  <value><int>1</int></value>
                                                </member>
                                                <member>
                                                  <name>min_duration</name>
                                                  <value><int>1</int></value>
                                                </member>
                                                <member>
                                                  <name>price</name>
                                                  <value><double>42</double></value>
                                                </member>
                                              </struct>
                                            </value>
                                          </data>
                                        </array>
                                      </value>
                                    </member>
                                  </struct>
                                </value>
                              </data>
                            </array>
                          </value>
                        </member>
                      </struct>
                    </value>
                  </data>
                </array>
              </value>
            </param>
          </params>
        </methodResponse>`,
        { status: 200 },
      ),
    );

    const result = await getGandiDomainRegistrationMetadata("ledgerpilot.ai");

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
          price: 42,
        },
      ],
      tld: "ai",
    });
  });

  it("builds domain details by combining availability and registration metadata", async () => {
    process.env.GANDI_API_TOKEN = "gandi_test_token";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          `<?xml version="1.0"?>
          <methodResponse>
            <params>
              <param>
                <value>
                  <struct>
                    <member>
                      <name>ledgerpilot.ai</name>
                      <value><string>available</string></value>
                    </member>
                  </struct>
                </value>
              </param>
            </params>
          </methodResponse>`,
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          `<?xml version="1.0"?>
          <methodResponse>
            <params>
              <param>
                <value>
                  <array>
                    <data>
                      <value>
                        <struct>
                          <member>
                            <name>available</name>
                            <value><string>available</string></value>
                          </member>
                          <member>
                            <name>current_phase</name>
                            <value><string>golive</string></value>
                          </member>
                          <member>
                            <name>extension</name>
                            <value><string>ledgerpilot.ai</string></value>
                          </member>
                          <member>
                            <name>name</name>
                            <value><string>ai</string></value>
                          </member>
                          <member>
                            <name>prices</name>
                            <value><array><data /></array></value>
                          </member>
                        </struct>
                      </value>
                    </data>
                  </array>
                </value>
              </param>
            </params>
          </methodResponse>`,
          { status: 200 },
        ),
      );

    const result = await getGandiDomainDetails("ledgerpilot.ai");

    assert.deepEqual(result, {
      availability: "available",
      currentPhase: "golive",
      domain: "ledgerpilot.ai",
      prices: [],
      tld: "ai",
    });
  });
});
