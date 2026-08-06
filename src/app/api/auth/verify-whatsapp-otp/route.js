import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { phone, otp } = await request.json();
    if (!phone || !otp) {
      return NextResponse.json({ success: false, error: "Nomor HP dan kode OTP wajib diisi." }, { status: 400 });
    }

    let formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "62" + formattedPhone.slice(1);
    }

    // Ambil data OTP dari Supabase
    const { data, error: dbError } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("phone", formattedPhone)
      .single();

    if (dbError || !data) {
      return NextResponse.json({ success: false, error: "Kode OTP tidak ditemukan atau belum pernah dikirim." }, { status: 400 });
    }

    // Validasi kecocokan OTP
    if (data.otp !== otp) {
      return NextResponse.json({ success: false, error: "Kode OTP yang Anda masukkan salah." }, { status: 400 });
    }

    // Validasi masa berlaku (kedaluwarsa dalam 5 menit)
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    if (now > expiresAt) {
      return NextResponse.json({ success: false, error: "Kode OTP telah kedaluwarsa." }, { status: 400 });
    }

    // Hapus OTP setelah berhasil diverifikasi agar tidak bisa dipakai dua kali
    await supabaseAdmin
      .from("otp_codes")
      .delete()
      .eq("phone", formattedPhone);

    return NextResponse.json({ 
      success: true, 
      message: "Verifikasi OTP berhasil.",
      user: {
        email: `${formattedPhone}@mameko.my.id`,
        name: "User WhatsApp"
      }
    });
  } catch (error) {
    console.error("Verify OTP Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}