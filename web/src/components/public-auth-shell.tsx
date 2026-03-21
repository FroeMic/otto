import Image from "next/image";

import { PixelLiquidBg } from "@/components/unlumen-ui/pixel-liquid-bg";
import { cn } from "@/lib/utils";

type PublicAuthShellProps = {
  children: React.ReactNode;
  className?: string;
  subtitle: string;
  title: string;
};

function PublicAuthShell({
  children,
  className,
  subtitle,
  title,
}: PublicAuthShellProps) {
  return (
    <main
      className={cn(
        "min-h-screen bg-background lg:grid lg:min-h-svh lg:grid-cols-[minmax(0,38rem)_1fr]",
        className,
      )}
    >
      <section className="relative flex min-h-svh flex-col border-border/60 bg-background px-6 py-6 md:px-10 md:py-8 lg:border-r">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium tracking-[0.16em] uppercase">
            Otto
          </span>
          <span className="border border-border px-2 py-1 text-[11px] font-medium tracking-[0.14em] uppercase text-muted-foreground">
            Invite only
          </span>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-10 md:py-14">
          <div className="flex flex-col items-start gap-6">
            <div className="overflow-hidden border border-border/60 bg-secondary/40 p-3">
              <Image
                alt="Otto avatar"
                className="h-auto w-full max-w-52"
                height={256}
                priority
                src="/otto-avatar.svg"
                width={256}
              />
            </div>
            <div className="flex flex-col gap-3">
              <h1 className="max-w-sm text-pretty text-4xl font-semibold tracking-tight md:text-5xl">
                {title}
              </h1>
              <p className="max-w-md text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
                {subtitle}
              </p>
            </div>
          </div>
          <div className="w-full">{children}</div>
        </div>
      </section>
      <aside className="relative hidden overflow-hidden bg-muted lg:block">
        <PixelLiquidBg
          autoDemo
          className="absolute inset-0"
          cursorSize={120}
          darkPalette={["#0f0b09", "#26160f", "#6b3b22", "#bf7c54", "#f0d0ae"]}
          lightPalette={["#fff8ef", "#f2dfcb", "#d9af86", "#9f5b3b", "#4b2516"]}
          mouseForce={7}
          pixelSize={32}
          resolution={0.38}
        >
          <div className="absolute inset-x-10 bottom-10 flex justify-end">
            <div className="border border-border/60 bg-background/80 px-4 py-3 text-right backdrop-blur">
              <p className="text-[11px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
                Workspace
              </p>
              <p className="mt-1 text-sm">
                Slack setup, runtime state, team access.
              </p>
            </div>
          </div>
        </PixelLiquidBg>
      </aside>
    </main>
  );
}

export { PublicAuthShell };
