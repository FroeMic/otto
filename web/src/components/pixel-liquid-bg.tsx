"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type PixelLiquidBgProps = React.ComponentProps<"div"> & {
  autoDemo?: boolean;
  children?: React.ReactNode;
  cursorSize?: number;
  darkPalette?: string[];
  lightPalette?: string[];
  mouseForce?: number;
  pixelSize?: number;
  resolution?: number;
};

type Blob = {
  life: number;
  radius: number;
  strength: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

const DEFAULT_DARK_PALETTE = [
  "#120c08",
  "#3d2317",
  "#7f4a2f",
  "#c97c54",
  "#f2d8b8",
];

const DEFAULT_LIGHT_PALETTE = [
  "#fffaf2",
  "#f4e3cc",
  "#ddb48a",
  "#b46c47",
  "#5b2d1c",
];

const BAYER_MATRIX = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const safeValue =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized.padEnd(6, "0").slice(0, 6);

  const value = Number.parseInt(safeValue, 16);

  return {
    b: value & 255,
    g: (value >> 8) & 255,
    r: (value >> 16) & 255,
  };
}

function parsePalette(palette: string[]) {
  return palette.map(hexToRgb);
}

function getPaletteColor(
  palette: ReturnType<typeof parsePalette>,
  value: number,
) {
  if (palette.length === 1) {
    return palette[0];
  }

  const scaled = clamp(value, 0, 0.9999) * (palette.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(lowerIndex + 1, palette.length - 1);
  const mixAmount = scaled - lowerIndex;
  const lower = palette[lowerIndex];
  const upper = palette[upperIndex];

  return {
    b: Math.round(lerp(lower.b, upper.b, mixAmount)),
    g: Math.round(lerp(lower.g, upper.g, mixAmount)),
    r: Math.round(lerp(lower.r, upper.r, mixAmount)),
  };
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => {
      mediaQuery.removeEventListener("change", updatePreference);
    };
  }, []);

  return prefersReducedMotion;
}

function PixelLiquidBg({
  autoDemo = true,
  children,
  className,
  cursorSize = 110,
  darkPalette = DEFAULT_DARK_PALETTE,
  lightPalette = DEFAULT_LIGHT_PALETTE,
  mouseForce = 8,
  pixelSize = 18,
  resolution = 0.4,
  ...props
}: PixelLiquidBgProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      return;
    }

    const blobs: Blob[] = [];
    const pointer = {
      x: 0.5,
      y: 0.5,
    };

    let animationFrame = 0;
    let cellHeight = 0;
    let cellWidth = 0;
    let gridHeight = 0;
    let gridWidth = 0;
    let imageData: ImageData | null = null;
    let isDarkMode = document.documentElement.classList.contains("dark");
    let lastTimestamp = performance.now();
    let lastInteractionAt = performance.now();
    const colorObserver = new MutationObserver(() => {
      isDarkMode = document.documentElement.classList.contains("dark");
    });

    const paletteForTheme = () =>
      parsePalette(isDarkMode ? darkPalette : lightPalette);

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      const scaledWidth = Math.max(1, Math.round(bounds.width * resolution));
      const scaledHeight = Math.max(1, Math.round(bounds.height * resolution));
      cellWidth = Math.max(1, Math.round(pixelSize));
      cellHeight = Math.max(1, Math.round(pixelSize));
      gridWidth = Math.max(1, Math.round(scaledWidth / cellWidth));
      gridHeight = Math.max(1, Math.round(scaledHeight / cellHeight));
      canvas.width = gridWidth;
      canvas.height = gridHeight;
      canvas.style.imageRendering = "pixelated";
      imageData = context.createImageData(gridWidth, gridHeight);
    };

    const addBlob = (
      normalizedX: number,
      normalizedY: number,
      velocityX: number,
      velocityY: number,
      strength = mouseForce,
    ) => {
      blobs.push({
        life: 1,
        radius: Math.max(0.14, cursorSize / 260),
        strength,
        vx: velocityX,
        vy: velocityY,
        x: clamp(normalizedX, 0, 1),
        y: clamp(normalizedY, 0, 1),
      });

      if (blobs.length > 18) {
        blobs.splice(0, blobs.length - 18);
      }
    };

    const updatePointerFromEvent = (clientX: number, clientY: number) => {
      const bounds = container.getBoundingClientRect();
      const nextX = clamp((clientX - bounds.left) / bounds.width, 0, 1);
      const nextY = clamp((clientY - bounds.top) / bounds.height, 0, 1);
      const velocityX = nextX - pointer.x;
      const velocityY = nextY - pointer.y;

      pointer.x = nextX;
      pointer.y = nextY;
      lastInteractionAt = performance.now();

      addBlob(
        nextX,
        nextY,
        velocityX * mouseForce * 0.2,
        velocityY * mouseForce * 0.2,
      );
    };

    const handlePointerMove = (event: PointerEvent) => {
      updatePointerFromEvent(event.clientX, event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches.item(0);

      if (touch) {
        updatePointerFromEvent(touch.clientX, touch.clientY);
      }
    };

    const draw = (timestamp: number) => {
      const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
      lastTimestamp = timestamp;

      if (!imageData) {
        resize();
      }

      const palette = paletteForTheme();
      const data = imageData?.data;

      if (!data) {
        animationFrame = requestAnimationFrame(draw);
        return;
      }

      if (autoDemo && !prefersReducedMotion) {
        const idleFor = timestamp - lastInteractionAt;

        if (idleFor > 1200) {
          const loopTime = timestamp / 1800;
          const demoX = 0.5 + Math.sin(loopTime) * 0.26;
          const demoY = 0.48 + Math.cos(loopTime * 1.37) * 0.2;
          addBlob(
            demoX,
            demoY,
            Math.cos(loopTime) * 0.01,
            Math.sin(loopTime * 0.7) * 0.01,
            mouseForce * 0.7,
          );
          lastInteractionAt = timestamp - 900;
        }
      }

      for (const blob of blobs) {
        blob.x = clamp(blob.x + blob.vx * delta * 4, -0.1, 1.1);
        blob.y = clamp(blob.y + blob.vy * delta * 4, -0.1, 1.1);
        blob.vx *= 0.985;
        blob.vy *= 0.985;
        blob.life *= prefersReducedMotion ? 0.92 : 0.975;
      }

      while (blobs.length > 0 && blobs[0].life < 0.05) {
        blobs.shift();
      }

      for (let y = 0; y < gridHeight; y += 1) {
        for (let x = 0; x < gridWidth; x += 1) {
          const normalizedX = gridWidth === 1 ? 0.5 : x / (gridWidth - 1);
          const normalizedY = gridHeight === 1 ? 0.5 : y / (gridHeight - 1);
          let field = 0;

          for (const blob of blobs) {
            const distanceX = normalizedX - blob.x;
            const distanceY = normalizedY - blob.y;
            const distanceSquared =
              distanceX * distanceX + distanceY * distanceY;

            field +=
              (blob.life * blob.strength * 0.018) /
              (distanceSquared + blob.radius * 0.06);
          }

          const swirl =
            0.08 *
            (Math.sin(normalizedX * 7 + timestamp * 0.00045) +
              Math.cos(normalizedY * 9 - timestamp * 0.00035));
          const threshold =
            (BAYER_MATRIX[((y & 3) << 2) | (x & 3)] / 16) * 0.045 - 0.0225;
          const color = getPaletteColor(
            palette,
            clamp(0.12 + field + swirl + threshold, 0, 1),
          );
          const pixelIndex = (y * gridWidth + x) * 4;

          data[pixelIndex] = color.r;
          data[pixelIndex + 1] = color.g;
          data[pixelIndex + 2] = color.b;
          data[pixelIndex + 3] = 255;
        }
      }

      context.putImageData(imageData as ImageData, 0, 0);
      animationFrame = requestAnimationFrame(draw);
    };

    resize();
    colorObserver.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    container.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("resize", resize);

    animationFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrame);
      colorObserver.disconnect();
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("resize", resize);
    };
  }, [
    autoDemo,
    cursorSize,
    darkPalette,
    lightPalette,
    mouseForce,
    pixelSize,
    prefersReducedMotion,
    resolution,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,transparent_0%,transparent_35%,rgba(255,255,255,0.16)_100%)]" />
      {children ? <div className="relative z-10">{children}</div> : null}
    </div>
  );
}

export { PixelLiquidBg };
