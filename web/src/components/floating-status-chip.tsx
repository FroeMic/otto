"use client";

import { CircleNotch } from "@phosphor-icons/react/ssr";

export function FloatingStatusChip(props: { message: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-green-600 px-3 py-1.5 shadow-lg">
        <CircleNotch className="size-3 animate-spin text-white" />
        <span className="text-xs font-medium text-white">{props.message}</span>
      </div>
    </div>
  );
}
