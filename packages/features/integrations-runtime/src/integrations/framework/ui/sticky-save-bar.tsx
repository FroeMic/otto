"use client";

import { Button } from "../../../components/ui/button";

export function IntegrationStickySaveBar(props: {
  description: string;
  discardLabel?: string;
  hasChanges: boolean;
  isPending: boolean;
  onDiscard: () => void;
  onSave: () => void;
  saveLabel?: string;
  title: string;
}) {
  const {
    description,
    discardLabel = "Discard",
    hasChanges,
    isPending,
    onDiscard,
    onSave,
    saveLabel = "Save changes",
    title,
  } = props;

  if (!hasChanges || isPending) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-6 bottom-10 left-6 z-30 sm:left-[max(1.5rem,calc(50%-24rem))] sm:right-auto sm:w-[min(100%-3rem,48rem)]">
      <div className="pointer-events-auto flex flex-col gap-3 rounded-2xl border bg-background/95 p-4 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/85 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            disabled={!hasChanges}
            onClick={onDiscard}
            type="button"
            variant="outline"
          >
            {discardLabel}
          </Button>
          <Button disabled={!hasChanges} onClick={onSave} type="button">
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
