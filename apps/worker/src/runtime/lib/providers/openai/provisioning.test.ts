import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __testing as envTesting } from "../../env";
import { OpenAiProvisioner } from "./provisioning";

const savedEnv = {
  CONTROL_PLANE_OPENAI_ADMIN_API_KEY:
    process.env.CONTROL_PLANE_OPENAI_ADMIN_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  RUNTIME_MODEL_PRIMARY: process.env.RUNTIME_MODEL_PRIMARY,
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

describe("OpenAiProvisioner", () => {
  beforeEach(() => {
    process.env.CONTROL_PLANE_OPENAI_ADMIN_API_KEY = "sk-admin-test";
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/otto";
    process.env.RUNTIME_MODEL_PRIMARY = "openai/gpt-5.4";
    envTesting.resetEnvCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.env.CONTROL_PLANE_OPENAI_ADMIN_API_KEY =
      savedEnv.CONTROL_PLANE_OPENAI_ADMIN_API_KEY;
    process.env.DATABASE_URL = savedEnv.DATABASE_URL;
    process.env.RUNTIME_MODEL_PRIMARY = savedEnv.RUNTIME_MODEL_PRIMARY;
    envTesting.resetEnvCacheForTests();
  });

  it("retries a transient invalid API key response after creating a service account", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        response({
          id: "proj_test",
          name: "otto_tenant_test",
        }),
      )
      .mockResolvedValueOnce(
        response({
          api_key: {
            id: "key_test",
            value: "sk-svcacct-test",
          },
          id: "svc_acct_test",
          name: "otto-tenant-test",
        }),
      )
      .mockResolvedValueOnce(
        response(
          {
            error: {
              code: "invalid_api_key",
              message:
                "Incorrect API key provided: sk-svcac************************test.",
              type: "invalid_request_error",
            },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(response({ id: "resp_test" }));

    const resultPromise = new OpenAiProvisioner().createTenantCredential({
      tenantId: "tenant_test",
      tenantName: "Test Tenant",
      verify: true,
    });

    await vi.runOnlyPendingTimersAsync();

    await expect(resultPromise).resolves.toMatchObject({
      apiKey: "sk-svcacct-test",
      apiKeyId: "key_test",
      projectId: "proj_test",
      serviceAccountId: "svc_acct_test",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not retry non-key verification failures", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        response({
          id: "proj_test",
          name: "otto_tenant_test",
        }),
      )
      .mockResolvedValueOnce(
        response({
          api_key: {
            id: "key_test",
            value: "sk-svcacct-test",
          },
          id: "svc_acct_test",
          name: "otto-tenant-test",
        }),
      )
      .mockResolvedValueOnce(
        response(
          {
            error: {
              code: "model_not_found",
              message: "The model does not exist.",
              type: "invalid_request_error",
            },
          },
          404,
        ),
      );

    await expect(
      new OpenAiProvisioner().createTenantCredential({
        tenantId: "tenant_test",
        tenantName: "Test Tenant",
        verify: true,
      }),
    ).rejects.toThrow(
      "The model does not exist. code=model_not_found type=invalid_request_error",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
