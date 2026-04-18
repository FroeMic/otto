import { describe, expect, it } from "vitest"

import {
  isStaleAssetLoadError,
  shouldReloadForStaleAsset,
} from "./stale-asset-reload"

describe("stale asset reload", () => {
  it("detects Vite dynamic import failures for app assets", () => {
    expect(
      isStaleAssetLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://getyourotto.com/assets/platform-CbYRPnUb.js",
        ),
      ),
    ).toBe(true)
  })

  it("ignores unrelated errors", () => {
    expect(isStaleAssetLoadError(new Error("Platform access required"))).toBe(
      false,
    )
  })

  it("reloads stale asset failures once per url inside the cooldown window", () => {
    const key = "otto.stale-asset-reload"
    const storage = new Map<string, string>()
    const adapter = {
      getItem: (name: string) => storage.get(name) ?? null,
      setItem: (name: string, value: string) => {
        storage.set(name, value)
      },
    }

    expect(
      shouldReloadForStaleAsset({
        now: 1_000,
        storage: adapter,
        storageKey: key,
        url: "/platform/organizations?workspace=interaction42",
      }),
    ).toBe(true)

    expect(
      shouldReloadForStaleAsset({
        now: 2_000,
        storage: adapter,
        storageKey: key,
        url: "/platform/organizations?workspace=interaction42",
      }),
    ).toBe(false)

    expect(
      shouldReloadForStaleAsset({
        now: 70_000,
        storage: adapter,
        storageKey: key,
        url: "/platform/organizations?workspace=interaction42",
      }),
    ).toBe(true)
  })
})
