import type { Experimental_GeneratedImage } from "ai";
import NextImage from "next/image";
import { cn } from "@/lib/utils";

export type ImageProps = Experimental_GeneratedImage & {
  className?: string;
  alt?: string;
  height?: number;
  sizes?: string;
  width?: number;
};

export const Image = ({
  base64,
  uint8Array: _uint8Array,
  mediaType,
  height = 1024,
  sizes = "100vw",
  width = 1024,
  ...props
}: ImageProps) => (
  <NextImage
    {...props}
    alt={props.alt ?? ""}
    className={cn(
      "h-auto max-w-full overflow-hidden rounded-md",
      props.className,
    )}
    src={`data:${mediaType};base64,${base64}`}
    height={height}
    sizes={sizes}
    unoptimized
    width={width}
  />
);
