import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { isSetupComplete } from "@/lib/db"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow setup routes and API routes
  if (pathname.startsWith("/setup") || pathname.startsWith("/api/setup")) {
    return NextResponse.next()
  }

  // Check if setup is complete
  try {
    const setupComplete = isSetupComplete()

    if (!setupComplete) {
      // Redirect to setup
      return NextResponse.redirect(new URL("/setup", request.url))
    }
  } catch (error) {
    console.error("[v0] Middleware error:", error)
    // If there's an error checking setup status, allow through
    // (database might not be initialized yet)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
