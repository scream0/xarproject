// src/app/api/auth/login/route.js
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token tidak ditemukan" },
        { status: 400 },
      );
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
      maxAge: 60 * 60 * 24 * 5, // 5 hari
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("API Auth Login Error:", error);
    return NextResponse.json(
      { error: "Gagal memproses sesi login" },
      { status: 500 },
    );
  }
}
