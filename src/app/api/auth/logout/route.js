// src/app/api/auth/logout/route.js
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const response = NextResponse.json({ success: true }, { status: 200 });

    // PENTING: opsi cookie saat menghapus HARUS SAMA PERSIS dengan opsi
    // saat di-set di /api/auth/login (name, path, secure, sameSite).
    // Kalau beda (misal lupa path), browser menganggap ini cookie yang
    // berbeda dan cookie "session" yang asli tidak akan terhapus.
    response.cookies.set({
      name: "session",
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 0, // langsung expire / hapus
    });

    return response;
  } catch (error) {
    console.error("API Auth Logout Error:", error);
    return NextResponse.json(
      { error: "Gagal memproses logout" },
      { status: 500 },
    );
  }
}
