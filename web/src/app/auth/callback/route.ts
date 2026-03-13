import { handleAuth } from "@workos-inc/authkit-nextjs";
import { type NextRequest, NextResponse } from "next/server";

import { syncUserFromSession } from "@/db/control-plane";
import { hasWorkOSConfig } from "@/lib/workos";

const authHandler = handleAuth({
  returnPathname: "/",
  onSuccess: async ({ user }) => {
    await syncUserFromSession(user);
  },
});

export function GET(request: NextRequest) {
  if (!hasWorkOSConfig()) {
    return NextResponse.json(
      { error: "WorkOS is not configured." },
      { status: 500 },
    );
  }

  return authHandler(request);
}
