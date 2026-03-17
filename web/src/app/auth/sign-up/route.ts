import { getSignUpUrl } from "@workos-inc/authkit-nextjs";
import { type NextRequest, NextResponse } from "next/server";

import { getWorkOSAuthConfig, hasWorkOSConfig } from "@/lib/workos";

function getReturnTo(request: NextRequest) {
  return request.nextUrl.searchParams.get("returnTo") ?? "/";
}

export async function GET(request: NextRequest) {
  if (!hasWorkOSConfig()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const signUpUrl = await getSignUpUrl({
    redirectUri: getWorkOSAuthConfig().redirectUri,
    returnTo: getReturnTo(request),
  });

  return NextResponse.redirect(signUpUrl);
}
