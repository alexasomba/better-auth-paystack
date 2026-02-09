import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  console.log("Middleware session cookie:", sessionCookie ? "FOUND" : "NOT FOUND");
  // This is the recommended approach to optimistically redirect users
  // We recommend handling auth checks in each page/route
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard"], // Specify the routes the middleware applies to
};

// OpenNext Cloudflare Adapter recommendation: 
// Use Edge Runtime for middleware to avoid Node.js compatibility issues.
export const runtime = "experimental-edge";
