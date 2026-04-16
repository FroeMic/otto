import path, { resolve } from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    emptyOutDir: false,
    outDir: resolve(__dirname, "dist/public"),
    rollupOptions: {
      input: {
        landing: resolve(__dirname, "src/client/landing.tsx"),
        workspace: resolve(__dirname, "src/client/main.tsx"),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === "landing"
            ? "assets/landing.js"
            : "assets/workspace.js",
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names.at(0) ?? assetInfo.name ?? ""

          if (name.endsWith(".css")) {
            return "assets/workspace.css"
          }

          return "assets/[name]-[hash][extname]"
        },
      },
    },
    sourcemap: true,
  },
})
