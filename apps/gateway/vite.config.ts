import { resolve } from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(
        __dirname,
        "../../packages/legacy-control-plane-runtime/src",
      ),
    },
  },
  test: {
    environment: "node",
  },
})
