import { NextResponse, type NextRequest } from "next/server";
import { stagingGate } from "@/lib/staging-gate";

const PUBLIC_PORTAL = [
  "/portal/login",
  "/portal/register",
  "/portal/invite",
  "/portal/forgot-password",
  "/portal/reset-password",
];

function hasSession(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.includes("session_token"));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const gate = stagingGate({
    appEnv: process.env.APP_ENV ?? "development",
    basicAuth: process.env.STAGING_BASIC_AUTH,
    authorizationHeader: request.headers.get("authorization"),
    pathname,
  });
  if (gate.action === "misconfigured") {
    return new NextResponse("Staging access is not configured.", { status: 503 });
  }
  if (gate.action === "challenge") {
    return new NextResponse("Authentication required.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Amalfi staging"' },
    });
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !pathname.startsWith("/admin/forgot-password") && !pathname.startsWith("/admin/reset-password") && !hasSession(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const portalPublic =
    PUBLIC_PORTAL.some((path) => pathname === path) || pathname.startsWith("/portal/api") || pathname.startsWith("/portal/unsubscribe");
  if (pathname.startsWith("/portal") && !portalPublic && !hasSession(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/portal/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", crypto.randomUUID());
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
