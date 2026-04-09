import { main } from "./app"

main().catch((error) => {
  console.error("[worker] fatal error", error)
  process.exit(1)
})
