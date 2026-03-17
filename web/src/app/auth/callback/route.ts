import { handleAuth } from "@workos-inc/authkit-nextjs";
import { type NextRequest, NextResponse } from "next/server";

import { syncUserFromSession } from "@/db/control-plane";
import { getWorkOSAuthConfig, hasWorkOSConfig } from "@/lib/workos";

function getAuthHandler() {
  return handleAuth({
    baseURL: getWorkOSAuthConfig().baseURL,
    returnPathname: "/",
    onSuccess: async ({ user }) => {
      await syncUserFromSession(user);
    },
  });
}

export function GET(request: NextRequest) {
  if (!hasWorkOSConfig()) {
    return NextResponse.json(
      { error: "WorkOS is not configured." },
      { status: 500 },
    );
  }

  return getAuthHandler()(request);
}
