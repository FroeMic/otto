"use client";

import {
  CheckCircle,
  Info,
  SpinnerGap,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react/ssr";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CheckCircle weight="bold" className="size-4 text-emerald-500" />
        ),
        info: <Info weight="bold" className="size-4" />,
        warning: <WarningCircle weight="bold" className="size-4" />,
        error: <XCircle weight="bold" className="size-4" />,
        loading: <SpinnerGap weight="bold" className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "1rem",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !py-2.5",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
