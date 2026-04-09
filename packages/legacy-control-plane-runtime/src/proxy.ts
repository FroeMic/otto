import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getWorkOSAuthConfig, hasWorkOSConfig } from "./lib/workos";

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!hasWorkOSConfig()) {
    return NextResponse.next();
  }

  const authMiddleware = authkitMiddleware({
    redirectUri: getWorkOSAuthConfig().redirectUri,
  });
  const response = await authMiddleware(request, event);

  return response ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
