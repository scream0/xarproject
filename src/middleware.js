// src/middleware.js
import { NextResponse } from "next/server";

export function middleware(request) {
  const sessionCookie = request.cookies.get("session")?.value;
  const { pathname } = request.url ? new URL(request.url) : request.nextUrl;

  // Jika mencoba akses dashboard tapi tidak ada cookie sesi
  if (pathname.startsWith("/dashboard") && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Jika sudah login tapi mencoba buka halaman login/register
  if (
    (pathname.startsWith("/login") || pathname.startsWith("/register")) &&
    sessionCookie
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Konfigurasi rute mana saja yang dipantau middleware
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
