import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json({ success: false, error: "Nomor WhatsApp wajib diisi." }, { status: 400 });
    }

    let formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "62" + formattedPhone.slice(1);
    }

    // Generate kode OTP 6 digit
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Simpan ke database Supabase
    const { error: dbError } = await supabaseAdmin
      .from("otp_codes")
      .upsert({ phone: formattedPhone, otp, expires_at: expiresAt });

    if (dbError) throw new Error("Gagal menyimpan kode OTP ke database.");

    const message = `Kode verifikasi Make Me Kool / XAR Anda adalah *${otp}*. Berlaku selama 5 menit. Jangan berikan kode ini kepada siapa pun.`;

    // Kirim perintah ke Server WhatsApp Baileys lokal (Port 3001)
    const waResponse = await fetch("http://localhost:3001/send-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: formattedPhone, message }),
    });

    const waResult = await waResponse.json();
    if (!waResponse.ok || !waResult.success) {
      throw new Error(waResult.error || "Gagal mengirim WhatsApp via Gateway Mandiri.");
    }

    return NextResponse.json({ success: true, message: "OTP berhasil dikirim ke WhatsApp." });
  } catch (error) {
    console.error("Self-Hosted Send OTP Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}