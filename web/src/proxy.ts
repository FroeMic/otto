import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWorkOSAuthConfig, hasWorkOSConfig } from "@/lib/workos";

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!hasWorkOSConfig()) {
    return NextResponse.next();
  }

  const authMiddleware = authkitMiddleware({
    redirectUri: getWorkOSAuthConfig().redirectUri,
  });

  return authMiddleware(request, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
