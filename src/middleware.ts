import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const start = Date.now();
  const { method, nextUrl } = req;
  const path = nextUrl.pathname;

  // Log every incoming request
  console.log(
    JSON.stringify({
      level: "info",
      message: "[req] incoming",
      method,
      path,
      ts: new Date().toISOString(),
    }),
  );

  const res = NextResponse.next();

  // Attach timing header so Railway HTTP logs show duration
  res.headers.set("X-Response-Time", `${Date.now() - start}ms`);
  return res;
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
