"use client";

import Nango from "@nangohq/frontend";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  connectSessionUrl: string;
  disabled?: boolean;
  label: string;
};

export function LinearConnectButton({
  connectSessionUrl,
  disabled = false,
  label,
}: Props) {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, startRefreshTransition] = useTransition();

  async function handleClick() {
    try {
      setIsConnecting(true);

      const response = await fetch(connectSessionUrl, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        message?: string;
        sessionToken?: string;
      };

      if (!response.ok || !payload.sessionToken) {
        throw new Error(
          payload.message ?? "Linear could not be opened right now.",
        );
      }

      const connect = new Nango().openConnectUI({
        onEvent: (event) => {
          if (event.type === "connect") {
            toast.success("Linear connected");
            setIsConnecting(false);
            startRefreshTransition(() => {
              router.refresh();
            });
            window.setTimeout(() => {
              router.refresh();
            }, 1000);
            return;
          }

          if (event.type === "close") {
            setIsConnecting(false);
          }
        },
      });

      connect.setSessionToken(payload.sessionToken);
    } catch (error) {
      setIsConnecting(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "Linear could not be opened right now.",
      );
    }
  }

  return (
    <Button
      disabled={disabled || isConnecting || isRefreshing}
      onClick={handleClick}
      type="button"
    >
      {label}
    </Button>
  );
}
