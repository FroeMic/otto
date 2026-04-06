import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

type Props = {
  connectUrl: string;
  disabled?: boolean;
  label: string;
};

export function LinearConnectButton({
  connectUrl,
  disabled = false,
  label,
}: Props) {
  if (disabled) {
    return (
      <Button disabled type="button">
        {label}
      </Button>
    );
  }

  return (
    <Link className={buttonVariants()} href={connectUrl}>
      {label}
    </Link>
  );
}
