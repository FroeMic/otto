import { SpinnerGap } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"output">) {
  return (
    <output
      aria-label="Loading"
      className={cn("inline-flex", className)}
      {...props}
    >
      <SpinnerGap
        aria-hidden="true"
        weight="bold"
        className="size-4 animate-spin"
      />
    </output>
  );
}

export { Spinner };
