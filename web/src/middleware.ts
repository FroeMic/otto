import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { hasWorkOSConfig } from "@/lib/workos";

const authMiddleware = authkitMiddleware();

export function middleware(request: NextRequest, event: NextFetchEvent) {
  if (!hasWorkOSConfig()) {
    return NextResponse.next();
  }

  return authMiddleware(request, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
