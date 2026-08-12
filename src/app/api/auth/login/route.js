// src/app/api/auth/login/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/utils/rateLimit";
import { logServerError } from "@/utils/logger";

// Create a rate limiter instance for the login route
const loginRateLimiter = rateLimit({ limit: 5, windowMs: 60 * 1000 });

export async function POST(request) {
  // Apply rate limiting
  const rateLimitResponse = await loginRateLimiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { token } = await request.json();

    if (typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        { error: "Token tidak ditemukan" },
        { status: 400 },
      );
    }

    // Never turn an arbitrary client value into an HttpOnly session cookie.
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
    }

    // Buat respons sukses
    const response = NextResponse.json({ success: true }, { status: 200 });

    // Set cookie sesi aman di server
    response.cookies.set({
      name: "session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // Access tokens have their own expiry; this only mirrors the active
      // session for legacy server endpoints.
      maxAge: 60 * 60,
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    logServerError("API Auth Login Error", error, { route: "/api/auth/login" });
    return NextResponse.json(
      { error: "Gagal memproses sesi login" },
      { status: 500 },
    );
  }
}
