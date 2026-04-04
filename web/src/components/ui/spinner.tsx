import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"output">) {
  return (
    <output
      aria-label="Loading"
      className={cn("inline-flex", className)}
      {...props}
    >
      <HugeiconsIcon
        aria-hidden="true"
        icon={Loading03Icon}
        strokeWidth={2}
        className="size-4 animate-spin"
      />
    </output>
  );
}

export { Spinner };
