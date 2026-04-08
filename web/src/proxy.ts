import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWorkOSAuthConfig, hasWorkOSConfig } from "@/lib/workos";

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!hasWorkOSConfig()) {
    return NextResponse.next();
  }

  const startedAt = Date.now();
  const { method } = request;
  const { pathname } = request.nextUrl;
  console.info("[proxy] auth middleware start", {
    method,
    pathname,
  });

  const authMiddleware = authkitMiddleware({
    redirectUri: getWorkOSAuthConfig().redirectUri,
  });

  try {
    const response = await authMiddleware(request, event);
    console.info("[proxy] auth middleware complete", {
      durationMs: Date.now() - startedAt,
      method,
      pathname,
      status: response?.status ?? null,
    });
    return response ?? NextResponse.next();
  } catch (error) {
    console.error("[proxy] auth middleware failed", {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
      method,
      pathname,
    });
    throw error;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
