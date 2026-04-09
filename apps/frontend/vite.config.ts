import { resolve } from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  plugins: [react(), tailwindcss()],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/client/main.tsx"),
      fileName: () => "workspace.js",
      formats: ["es"],
      name: "OttoWorkspace",
    },
    outDir: resolve(__dirname, "dist/public/app"),
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names.at(0) ?? assetInfo.name ?? ""

          if (name.endsWith(".css")) {
            return "workspace.css"
          }

          return "assets/[name]-[hash][extname]"
        },
      },
    },
    sourcemap: true,
  },
})
