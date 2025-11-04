import type { MiddlewareHandler } from "astro";
import { isSetupComplete } from "@/lib/db";

export const onRequest: MiddlewareHandler = async ({ request, redirect }, next) => {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/setup") || pathname.startsWith("/api/setup")) {
    return next();
  }

  try {
    if (!isSetupComplete()) {
      return redirect("/setup");
    }
  } catch (error) {
    console.error("[v0] Middleware error:", error);
  }

  return next();
};
