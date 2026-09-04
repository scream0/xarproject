// src/proxy.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// --- Cache Rate Limiter untuk Edge Instance ---
const ipCache = new Map();
let lastCleared = Date.now();

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // 1. Global Rate Limiter untuk Endpoint API
  if (pathname.startsWith('/api')) {
    // Pengecualian (Bypass) untuk Webhook Midtrans
    if (!pathname.startsWith('/api/webhook')) {
      const ip = request.headers.get('x-forwarded-for') || request.ip || '127.0.0.1';
      const limit = 300; 
      const windowMs = 60 * 1000; // 1 menit

      if (Date.now() - lastCleared > windowMs) {
        ipCache.clear();
        lastCleared = Date.now();
      }

      let current = ipCache.get(ip) || 0;
      
      if (current >= limit) {
        return NextResponse.json(
          { error: 'Terlalu banyak permintaan (Global Rate Limit). Silakan coba lagi dalam 1 menit.' },
          { status: 429 }
        );
      }
      ipCache.set(ip, current + 1);
    }
    
    // Kembalikan response langsung agar API route tidak perlu memverifikasi session Supabase
    // (karena API route sudah punya mekanisme verifikasi token sendiri)
    return NextResponse.next();
  }

  // 2. Refresh Supabase Session & Route Protection
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookie di request (untuk dibaca ulang di server component)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Buat response baru supaya cookie ikut terkirim ke browser
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Ini juga otomatis refresh token kalau sudah mau expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belum login tapi coba akses dashboard
  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/checkout") || pathname.startsWith("/account")) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Sudah login tapi coba buka login/register
  if (
    (pathname.startsWith("/login") || pathname.startsWith("/register")) &&
    user
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*", 
    "/checkout", 
    "/account/:path*", 
    "/login", 
    "/register"
  ],
};
