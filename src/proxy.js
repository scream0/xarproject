// src/proxy.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request) {
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

  const { pathname } = request.nextUrl;

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
  matcher: ["/dashboard/:path*", "/checkout", "/account/:path*", "/login", "/register"],
};
