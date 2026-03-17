import { type NextRequest, NextResponse } from "next/server";

import { hasWorkOSConfig } from "@/lib/workos";

function getReturnTo(request: NextRequest) {
  return request.nextUrl.searchParams.get("returnTo") ?? "/";
}

export async function GET(request: NextRequest) {
  if (!hasWorkOSConfig()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const registerUrl = new URL("/register", request.url);
  registerUrl.searchParams.set("returnTo", getReturnTo(request));

  return NextResponse.redirect(registerUrl);
}
