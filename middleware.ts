import { NextRequest, NextResponse } from "next/server";

/**
 * Basic Auth für die gesamte App.
 * Ausgenommen (siehe matcher): Next-Assets, Manifest, Service Worker, Icons
 * sowie /api/check (durch CRON_SECRET-Bearer-Token geschützt).
 */
export function middleware(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!user || !password) {
    return new NextResponse(
      "Server nicht konfiguriert: BASIC_AUTH_USER / BASIC_AUTH_PASSWORD fehlen.",
      { status: 500 }
    );
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const [givenUser, ...rest] = atob(header.slice(6)).split(":");
      if (givenUser === user && rest.join(":") === password) {
        return NextResponse.next();
      }
    } catch {
      // ungültiges Base64 → 401
    }
  }

  return new NextResponse("Anmeldung erforderlich", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Kittymampf", charset="UTF-8"' },
  });
}

export const config = {
  // Node-Runtime statt Edge: umgeht MIDDLEWARE_INVOCATION_FAILED durch
  // Edge-Adapter-Regressionen in Vercels Build-Pipeline bei Next 15.5.x
  runtime: "nodejs",
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest\\.webmanifest|sw\\.js|api/check).*)",
  ],
};
