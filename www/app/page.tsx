import Link from "next/link"

import { buttonVariants } from "@/lib/button-variants"
import { cn } from "@/lib/utils"

export default function Page() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="flex w-full max-w-xl flex-col items-center gap-6 rounded-[2rem] border border-border/70 bg-card px-8 py-12 text-center shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Otto
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Public site placeholder
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Use the workspace app to sign in.
          </p>
        </div>

        <Link
          href="https://app.getyourotto.com/login"
          className={cn(buttonVariants({ size: "lg" }))}
        >
          Go to app login
        </Link>
      </div>
    </main>
  )
}
