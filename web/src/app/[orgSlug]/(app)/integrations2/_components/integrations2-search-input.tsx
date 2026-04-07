"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { ToolbarSearchInput } from "@/components/toolbar-search-input";

export function Integrations2SearchInput({
  initialValue,
}: {
  initialValue: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <ToolbarSearchInput
      aria-label="Search integrations"
      defaultValue={initialValue}
      disabled={isPending}
      placeholder="Search integrations..."
      onChange={(event) => {
        const nextValue = event.target.value.trim();
        const params = new URLSearchParams(searchParams.toString());

        if (nextValue) {
          params.set("q", nextValue);
        } else {
          params.delete("q");
        }

        const query = params.toString();

        startTransition(() => {
          router.replace(`${pathname}${query ? `?${query}` : ""}`, {
            scroll: false,
          });
        });
      }}
    />
  );
}
